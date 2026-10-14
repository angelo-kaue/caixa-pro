-- CaixaPro 0007: direitos do titular (LGPD). Exportação dos próprios dados.
-- A exclusão de conta é feita pela Edge Function delete-account (remove o usuário; todos os dados caem em cascata).

create function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ws uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select w.id into v_ws from public.workspaces w where w.owner_id = v_uid limit 1;

  return jsonb_build_object(
    'exported_at', now(),
    'user', jsonb_build_object('id', v_uid, 'email', (select u.email from auth.users u where u.id = v_uid)),
    'workspace', (select jsonb_build_object('id', w.id, 'type', w.type, 'name', w.name, 'initial_balance_cents', w.initial_balance_cents, 'created_at', w.created_at)
                  from public.workspaces w where w.id = v_ws),
    'subscription', (select jsonb_build_object('plan', s.plan_id, 'status', s.status, 'billing_mode', s.billing_mode, 'access_until', s.access_until, 'cancel_at_period_end', s.cancel_at_period_end, 'created_at', s.created_at)
                     from public.subscriptions s where s.workspace_id = v_ws),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'kind', c.kind, 'custom', not c.is_system) order by c.kind, c.name)
                            from public.categories c where c.workspace_id = v_ws), '[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(jsonb_build_object('date', t.occurred_on, 'kind', t.kind, 'amount_cents', t.amount_cents, 'description', t.description,
                              'category', c.name, 'payment_method', t.payment_method, 'created_at', t.created_at) order by t.occurred_on, t.created_at)
                              from public.transactions t left join public.categories c on c.id = t.category_id and c.workspace_id = t.workspace_id
                              where t.workspace_id = v_ws), '[]'::jsonb),
    'budgets', coalesce((select jsonb_agg(jsonb_build_object('category', c.name, 'amount_cents', b.amount_cents, 'active', b.active))
                         from public.budgets b join public.categories c on c.id = b.category_id and c.workspace_id = b.workspace_id
                         where b.workspace_id = v_ws), '[]'::jsonb),
    'goals', coalesce((select jsonb_agg(jsonb_build_object('name', g.name, 'target_cents', g.target_cents, 'current_cents', g.current_cents, 'target_date', g.target_date))
                       from public.goals g where g.workspace_id = v_ws), '[]'::jsonb),
    'recurring_rules', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'amount_cents', r.amount_cents, 'description', r.description, 'category', c.name,
                                 'day_of_month', r.day_of_month, 'start_on', r.start_on, 'end_on', r.end_on, 'active', r.active))
                                 from public.recurring_rules r left join public.categories c on c.id = r.category_id and c.workspace_id = r.workspace_id
                                 where r.workspace_id = v_ws), '[]'::jsonb),
    'bills', coalesce((select jsonb_agg(jsonb_build_object('kind', b.kind, 'description', b.description, 'amount_cents', b.amount_cents, 'due_on', b.due_on,
                       'status', b.status, 'paid_on', b.paid_on, 'category', c.name))
                       from public.bills b left join public.categories c on c.id = b.category_id and c.workspace_id = b.workspace_id
                       where b.workspace_id = v_ws), '[]'::jsonb),
    'classification_rules', coalesce((select jsonb_agg(jsonb_build_object('keyword', r.keyword, 'category', c.name))
                                      from public.category_rules r join public.categories c on c.id = r.category_id and c.workspace_id = r.workspace_id
                                      where r.workspace_id = v_ws), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- Correção: a exclusão de conta zera transactions.created_by (FK on delete set null), e o gatilho de lançamentos
-- recusava essa alteração. Agora aceita só a troca para NULL.
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
    -- created_by só pode virar NULL (ação "on delete set null" ao excluir o usuário); qualquer outra troca é recusada.
    if new.created_by is distinct from old.created_by and new.created_by is not null then
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
