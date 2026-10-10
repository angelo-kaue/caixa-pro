-- CaixaPro 0002: funções auxiliares, limites de plano e criação de espaço de trabalho

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Pertence ao espaço? (SECURITY DEFINER evita recursão de RLS em workspace_members)
create function public.is_workspace_member(p_workspace uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace and m.user_id = auth.uid()
  );
$$;

create function public.has_workspace_role(p_workspace uuid, p_roles public.member_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace and m.user_id = auth.uid() and m.role = any (p_roles)
  );
$$;

-- Plano efetivo: apenas assinaturas ativas ou em teste valem; qualquer outro caso cai no Free.
create function public.workspace_plan(p_workspace uuid) returns public.plan_id
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.plan_id from public.subscriptions s
      where s.workspace_id = p_workspace and s.status in ('active', 'trialing')),
    'free'::public.plan_id
  );
$$;

-- Primeiro dia do histórico visível. "3 meses" = mês atual + 2 anteriores. NULL = histórico completo.
create function public.history_cutoff(p_workspace uuid) returns date
language sql stable security definer set search_path = '' as $$
  select case
    when p.history_months is null then null
    else (date_trunc('month', current_date) - make_interval(months => p.history_months - 1))::date
  end
  from public.plans p
  where p.id = public.workspace_plan(p_workspace);
$$;

-- Limites do plano, aplicados no banco (a interface apenas exibe o estado).
create function public.enforce_transaction_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plan_id;
  v_max integer;
  v_months integer;
  v_cutoff date;
  v_count integer;
  v_month_start date;
begin
  if tg_op = 'UPDATE' then
    if new.workspace_id <> old.workspace_id then
      raise exception 'WORKSPACE_IMMUTABLE';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'CREATED_BY_IMMUTABLE';
    end if;
    -- Só reavalia limites se a data mudou de mês.
    if date_trunc('month', new.occurred_on) = date_trunc('month', old.occurred_on) then
      return new;
    end if;
  end if;

  v_plan := public.workspace_plan(new.workspace_id);
  select p.max_transactions_per_month, p.history_months into v_max, v_months
  from public.plans p where p.id = v_plan;

  if v_months is not null then
    v_cutoff := (date_trunc('month', current_date) - make_interval(months => v_months - 1))::date;
    if new.occurred_on < v_cutoff then
      raise exception 'HISTORY_LIMIT';
    end if;
  end if;

  if v_max is not null then
    v_month_start := date_trunc('month', new.occurred_on)::date;
    -- Serializa inserções concorrentes do mesmo espaço e mês.
    perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text || v_month_start::text, 0));
    select count(*) into v_count
    from public.transactions t
    where t.workspace_id = new.workspace_id
      and t.occurred_on >= v_month_start
      and t.occurred_on < (v_month_start + interval '1 month')::date
      and t.id <> new.id;
    if v_count >= v_max then
      raise exception 'MONTHLY_LIMIT_REACHED';
    end if;
  end if;

  return new;
end;
$$;

create trigger transactions_enforce_limits before insert or update on public.transactions
  for each row execute function public.enforce_transaction_limits();

-- Cria espaço de trabalho + vínculo de administrador + assinatura Free + categorias padrão, de forma atômica.
create function public.create_workspace(
  p_type public.workspace_type,
  p_name text,
  p_initial_balance_cents bigint default 0
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'INVALID_NAME';
  end if;
  if p_initial_balance_cents is null or abs(p_initial_balance_cents) > 99999999999 then
    raise exception 'INVALID_BALANCE';
  end if;
  if exists (select 1 from public.workspaces w where w.owner_id = v_uid) then
    raise exception 'WORKSPACE_ALREADY_EXISTS';
  end if;

  insert into public.workspaces (owner_id, type, name, initial_balance_cents)
  values (v_uid, p_type, v_name, p_initial_balance_cents)
  returning id into v_id;

  insert into public.workspace_members (workspace_id, user_id, role) values (v_id, v_uid, 'admin');
  insert into public.subscriptions (workspace_id, plan_id, status) values (v_id, 'free', 'active');

  insert into public.categories (workspace_id, name, kind, is_system)
  select v_id, c.name, c.kind::public.transaction_kind, true
  from (values
    ('Alimentação', 'expense'), ('Transporte', 'expense'), ('Moradia', 'expense'),
    ('Contas e serviços', 'expense'), ('Saúde', 'expense'), ('Lazer', 'expense'),
    ('Educação', 'expense'), ('Compras', 'expense'), ('Outros', 'expense'),
    ('Salário', 'income'), ('Vendas', 'income'), ('Outras receitas', 'income')
  ) as c(name, kind);

  if p_type = 'business' then
    insert into public.categories (workspace_id, name, kind, is_system)
    values (v_id, 'Fornecedores', 'expense', true), (v_id, 'Marketing', 'expense', true),
           (v_id, 'Equipamentos', 'expense', true);
  end if;

  return v_id;
end;
$$;

-- Execução: nada para anon/public; apenas usuários autenticados nas funções de uso do cliente.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_transaction_limits() from public, anon, authenticated;
revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.has_workspace_role(uuid, public.member_role[]) from public, anon;
revoke all on function public.workspace_plan(uuid) from public, anon;
revoke all on function public.history_cutoff(uuid) from public, anon;
revoke all on function public.create_workspace(public.workspace_type, text, bigint) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, public.member_role[]) to authenticated;
grant execute on function public.workspace_plan(uuid) to authenticated;
grant execute on function public.history_cutoff(uuid) to authenticated;
grant execute on function public.create_workspace(public.workspace_type, text, bigint) to authenticated;
