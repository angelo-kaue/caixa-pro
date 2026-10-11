-- CaixaPro 0005: recursos da Fase 3 (orçamentos, metas, recorrências, contas a pagar/receber, séries mensais)
-- Recursos por plano passam a existir no banco (plans.features) para serem validados no backend.

alter table public.plans add column features text[] not null default '{}';
update public.plans set features = array['advanced_charts','period_comparison','insights','goals','recurring','export','detailed_reports'] where id = 'pro';
update public.plans set features = array['advanced_charts','period_comparison','insights','goals','recurring','export','detailed_reports','multi_user','roles','multi_cash','consolidated_reports','audit'] where id = 'enterprise';

-- Gatilhos BEFORE rodam antes do RLS: sem esta checagem, um usuário de fora poderia deduzir limites e
-- regras de outro espaço pela mensagem de erro. Chamadas sem usuário (service role) passam direto.
create function public.assert_member_when_user(p_workspace uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_workspace_member(p_workspace) then
    raise exception 'FORBIDDEN';
  end if;
end;
$$;
revoke all on function public.assert_member_when_user(uuid) from public, anon, authenticated;

create function public.workspace_has_feature(p_workspace uuid, p_feature text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.features @> array[p_feature] from public.plans p where p.id = public.workspace_plan(p_workspace)),
    false
  );
$$;

------------------------------------------------------------------ orçamentos
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  category_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 99999999999),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, category_id),
  foreign key (category_id, workspace_id) references public.categories (id, workspace_id) on delete cascade
);

create function public.enforce_budget_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kind public.transaction_kind;
  v_max integer;
  v_count integer;
begin
  perform public.assert_member_when_user(new.workspace_id);
  if tg_op = 'UPDATE' and new.workspace_id <> old.workspace_id then
    raise exception 'WORKSPACE_IMMUTABLE';
  end if;
  select c.kind into v_kind from public.categories c where c.id = new.category_id and c.workspace_id = new.workspace_id;
  if v_kind is distinct from 'expense'::public.transaction_kind then
    raise exception 'BUDGET_NEEDS_EXPENSE_CATEGORY';
  end if;
  if tg_op = 'INSERT' and exists (
    select 1 from public.budgets b where b.workspace_id = new.workspace_id and b.category_id = new.category_id
  ) then
    raise exception 'BUDGET_ALREADY_EXISTS';
  end if;
  if new.active and (tg_op = 'INSERT' or not old.active) then
    select p.max_active_budgets into v_max from public.plans p where p.id = public.workspace_plan(new.workspace_id);
    if v_max is not null then
      perform pg_advisory_xact_lock(hashtextextended('budget' || new.workspace_id::text, 0));
      select count(*) into v_count from public.budgets b
        where b.workspace_id = new.workspace_id and b.active and b.id <> new.id;
      if v_count >= v_max then
        raise exception 'BUDGET_LIMIT_REACHED';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger budgets_rules before insert or update on public.budgets for each row execute function public.enforce_budget_rules();
create trigger budgets_updated_at before update on public.budgets for each row execute function public.set_updated_at();

------------------------------------------------------------------ metas
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  target_cents bigint not null check (target_cents > 0 and target_cents <= 99999999999),
  current_cents bigint not null default 0 check (current_cents >= 0 and current_cents <= 99999999999),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.enforce_goal_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_member_when_user(new.workspace_id);
  if tg_op = 'UPDATE' and new.workspace_id <> old.workspace_id then
    raise exception 'WORKSPACE_IMMUTABLE';
  end if;
  -- Metas existentes continuam editáveis após um downgrade; criar novas exige o recurso.
  if tg_op = 'INSERT' and not public.workspace_has_feature(new.workspace_id, 'goals') then
    raise exception 'FEATURE_NOT_AVAILABLE';
  end if;
  return new;
end;
$$;
create trigger goals_rules before insert or update on public.goals for each row execute function public.enforce_goal_rules();
create trigger goals_updated_at before update on public.goals for each row execute function public.set_updated_at();

------------------------------------------------------------------ recorrências
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.transaction_kind not null,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 99999999999),
  description text not null check (char_length(btrim(description)) between 1 and 140),
  category_id uuid,
  payment_method text check (payment_method is null or payment_method in ('pix', 'credit_card', 'debit_card', 'cash', 'bank_slip', 'transfer', 'other')),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  start_on date not null default current_date,
  end_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_on is null or end_on >= start_on),
  foreign key (category_id, workspace_id) references public.categories (id, workspace_id)
);

-- Registro de cada mês já gerado: apagar o lançamento gerado não faz ele reaparecer.
create table public.recurring_runs (
  rule_id uuid not null references public.recurring_rules (id) on delete cascade,
  month date not null,
  created_at timestamptz not null default now(),
  primary key (rule_id, month)
);

create function public.enforce_recurring_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_kind public.transaction_kind;
begin
  perform public.assert_member_when_user(new.workspace_id);
  if tg_op = 'UPDATE' and new.workspace_id <> old.workspace_id then
    raise exception 'WORKSPACE_IMMUTABLE';
  end if;
  if new.category_id is not null then
    select c.kind into v_kind from public.categories c where c.id = new.category_id and c.workspace_id = new.workspace_id;
    if v_kind is distinct from new.kind then
      raise exception 'CATEGORY_KIND_MISMATCH';
    end if;
  end if;
  if (tg_op = 'INSERT' or (new.active and not old.active))
     and not public.workspace_has_feature(new.workspace_id, 'recurring') then
    raise exception 'FEATURE_NOT_AVAILABLE';
  end if;
  return new;
end;
$$;
create trigger recurring_rules_rules before insert or update on public.recurring_rules for each row execute function public.enforce_recurring_rules();
create trigger recurring_rules_updated_at before update on public.recurring_rules for each row execute function public.set_updated_at();

-- Gera os lançamentos recorrentes devidos até hoje (no máximo 12 meses para trás). Idempotente.
create function public.generate_recurring(p_workspace uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_today date := current_date;
  v_cur date := date_trunc('month', current_date)::date;
  m date;
  v_last integer;
  v_due date;
  v_created integer := 0;
  n integer;
begin
  if not public.is_workspace_member(p_workspace) then
    raise exception 'FORBIDDEN';
  end if;
  if not public.workspace_has_feature(p_workspace, 'recurring') then
    return 0;
  end if;

  for r in select * from public.recurring_rules where workspace_id = p_workspace and active order by created_at loop
    m := greatest(date_trunc('month', r.start_on)::date, (v_cur - interval '11 months')::date);
    while m <= v_cur loop
      v_last := extract(day from (m + interval '1 month' - interval '1 day'))::integer;
      v_due := m + (least(r.day_of_month::integer, v_last) - 1);
      if v_due >= r.start_on and v_due <= v_today and (r.end_on is null or v_due <= r.end_on) then
        insert into public.recurring_runs (rule_id, month) values (r.id, m) on conflict do nothing;
        get diagnostics n = row_count;
        if n = 1 then
          insert into public.transactions (workspace_id, created_by, kind, amount_cents, description, category_id, occurred_on, payment_method)
          values (r.workspace_id, auth.uid(), r.kind, r.amount_cents, r.description, r.category_id, v_due, r.payment_method);
          v_created := v_created + 1;
        end if;
      end if;
      m := (m + interval '1 month')::date;
    end loop;
  end loop;
  return v_created;
end;
$$;

------------------------------------------------------------------ contas a pagar e a receber
create type public.bill_status as enum ('pending', 'paid');

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- expense = a pagar, income = a receber
  kind public.transaction_kind not null,
  description text not null check (char_length(btrim(description)) between 1 and 140),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 99999999999),
  due_on date not null,
  category_id uuid,
  status public.bill_status not null default 'pending',
  paid_on date,
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'paid') = (paid_on is not null)),
  foreign key (category_id, workspace_id) references public.categories (id, workspace_id)
);
create index bills_ws_status_due_idx on public.bills (workspace_id, status, due_on);

create function public.enforce_bill_rules() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_kind public.transaction_kind;
begin
  perform public.assert_member_when_user(new.workspace_id);
  if tg_op = 'UPDATE' then
    if new.workspace_id <> old.workspace_id then
      raise exception 'WORKSPACE_IMMUTABLE';
    end if;
    if old.status = 'paid' and new.status = 'paid'
       and (new.amount_cents <> old.amount_cents or new.kind <> old.kind or new.due_on <> old.due_on
            or new.description <> old.description or new.category_id is distinct from old.category_id) then
      raise exception 'BILL_PAID_LOCKED';
    end if;
  end if;
  if tg_op = 'INSERT' and not exists (select 1 from public.workspaces w where w.id = new.workspace_id and w.type = 'business') then
    raise exception 'BUSINESS_ONLY';
  end if;
  if new.category_id is not null then
    select c.kind into v_kind from public.categories c where c.id = new.category_id and c.workspace_id = new.workspace_id;
    if v_kind is distinct from new.kind then
      raise exception 'CATEGORY_KIND_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;
create trigger bills_rules before insert or update on public.bills for each row execute function public.enforce_bill_rules();
create trigger bills_updated_at before update on public.bills for each row execute function public.set_updated_at();

-- Baixa a conta: cria o lançamento e marca como paga/recebida, de forma atômica.
create function public.settle_bill(p_bill uuid, p_paid_on date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  b public.bills;
  v_tx uuid;
begin
  select * into b from public.bills where id = p_bill for update;
  if not found or not public.is_workspace_member(b.workspace_id) then
    raise exception 'FORBIDDEN';
  end if;
  if b.status = 'paid' then
    raise exception 'ALREADY_PAID';
  end if;
  if p_paid_on is null then
    raise exception 'INVALID_DATE';
  end if;
  insert into public.transactions (workspace_id, created_by, kind, amount_cents, description, category_id, occurred_on)
  values (b.workspace_id, auth.uid(), b.kind, b.amount_cents, b.description, b.category_id, p_paid_on)
  returning id into v_tx;
  update public.bills set status = 'paid', paid_on = p_paid_on, transaction_id = v_tx where id = p_bill;
  return v_tx;
end;
$$;

create function public.reopen_bill(p_bill uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare b public.bills;
begin
  select * into b from public.bills where id = p_bill for update;
  if not found or not public.is_workspace_member(b.workspace_id) then
    raise exception 'FORBIDDEN';
  end if;
  if b.status <> 'paid' then
    raise exception 'NOT_PAID';
  end if;
  if b.transaction_id is not null then
    delete from public.transactions where id = b.transaction_id;
  end if;
  update public.bills set status = 'pending', paid_on = null, transaction_id = null where id = p_bill;
end;
$$;

create function public.bills_overview(p_workspace uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_workspace_member(p_workspace) then
    raise exception 'FORBIDDEN';
  end if;
  return (
    select jsonb_build_object(
      'payable_cents', coalesce(sum(b.amount_cents) filter (where b.kind = 'expense'), 0),
      'receivable_cents', coalesce(sum(b.amount_cents) filter (where b.kind = 'income'), 0),
      'overdue_payable_cents', coalesce(sum(b.amount_cents) filter (where b.kind = 'expense' and b.due_on < current_date), 0),
      'overdue_receivable_cents', coalesce(sum(b.amount_cents) filter (where b.kind = 'income' and b.due_on < current_date), 0),
      'overdue_count', count(*) filter (where b.due_on < current_date)
    )
    from public.bills b where b.workspace_id = p_workspace and b.status = 'pending'
  );
end;
$$;

------------------------------------------------------------------ série mensal (gráficos avançados)
create function public.monthly_series(p_workspace uuid, p_months integer default 6) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_workspace_member(p_workspace) then
    raise exception 'FORBIDDEN';
  end if;
  if not public.workspace_has_feature(p_workspace, 'advanced_charts') then
    raise exception 'FEATURE_NOT_AVAILABLE';
  end if;
  if p_months is null or p_months < 1 or p_months > 24 then
    raise exception 'INVALID_PERIOD';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'month', to_char(s.m, 'YYYY-MM-DD'),
      'income_cents', coalesce(a.income, 0),
      'expense_cents', coalesce(a.expense, 0)
    ) order by s.m)
    from (
      select generate_series(
        (date_trunc('month', current_date) - make_interval(months => p_months - 1))::date,
        date_trunc('month', current_date)::date,
        interval '1 month'
      )::date as m
    ) s
    left join lateral (
      select sum(t.amount_cents) filter (where t.kind = 'income') as income,
             sum(t.amount_cents) filter (where t.kind = 'expense') as expense
      from public.transactions t
      where t.workspace_id = p_workspace and t.occurred_on >= s.m and t.occurred_on < (s.m + interval '1 month')::date
    ) a on true
  ), '[]'::jsonb);
end;
$$;

------------------------------------------------------------------ RLS e privilégios
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.recurring_runs enable row level security;
alter table public.bills enable row level security;

revoke all on public.budgets, public.goals, public.recurring_rules, public.recurring_runs, public.bills from anon, authenticated;
grant select, insert, update, delete on public.budgets, public.goals, public.recurring_rules to authenticated;
-- Contas: status, paid_on e transaction_id só mudam pelas funções settle_bill/reopen_bill.
grant select, delete on public.bills to authenticated;
grant insert (workspace_id, kind, description, amount_cents, due_on, category_id) on public.bills to authenticated;
grant update (description, amount_cents, due_on, category_id) on public.bills to authenticated;

create policy budgets_all on public.budgets for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy goals_all on public.goals for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy recurring_rules_all on public.recurring_rules for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy bills_all on public.bills for all to authenticated
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

revoke all on function public.enforce_budget_rules() from public, anon, authenticated;
revoke all on function public.enforce_goal_rules() from public, anon, authenticated;
revoke all on function public.enforce_recurring_rules() from public, anon, authenticated;
revoke all on function public.enforce_bill_rules() from public, anon, authenticated;
revoke all on function public.workspace_has_feature(uuid, text) from public, anon;
revoke all on function public.generate_recurring(uuid) from public, anon;
revoke all on function public.settle_bill(uuid, date) from public, anon;
revoke all on function public.reopen_bill(uuid) from public, anon;
revoke all on function public.bills_overview(uuid) from public, anon;
revoke all on function public.monthly_series(uuid, integer) from public, anon;
grant execute on function public.workspace_has_feature(uuid, text) to authenticated;
grant execute on function public.generate_recurring(uuid) to authenticated;
grant execute on function public.settle_bill(uuid, date) to authenticated;
grant execute on function public.reopen_bill(uuid) to authenticated;
grant execute on function public.bills_overview(uuid) to authenticated;
grant execute on function public.monthly_series(uuid, integer) to authenticated;

------------------------------------------------------------------ gatilho de lançamentos com checagem de associação
create or replace function public.enforce_transaction_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plan_id;
  v_max integer;
  v_months integer;
  v_cutoff date;
  v_count integer;
  v_month_start date;
begin
  perform public.assert_member_when_user(new.workspace_id);

  if tg_op = 'UPDATE' then
    if new.workspace_id <> old.workspace_id then
      raise exception 'WORKSPACE_IMMUTABLE';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'CREATED_BY_IMMUTABLE';
    end if;
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
