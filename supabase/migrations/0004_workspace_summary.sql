-- CaixaPro 0004: resumo financeiro calculado no banco.
-- O saldo considera TODOS os lançamentos (inclusive os fora da janela de histórico do plano, que ficam
-- preservados). Os totais do período respeitam a janela de histórico do plano.

create function public.workspace_summary(p_workspace uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cutoff date;
  v_from date;
  v_initial bigint;
  v_all_income bigint;
  v_all_expense bigint;
  v_income bigint := 0;
  v_expense bigint := 0;
  v_cats jsonb := '[]'::jsonb;
begin
  if not public.is_workspace_member(p_workspace) then
    raise exception 'FORBIDDEN';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'INVALID_PERIOD';
  end if;

  select w.initial_balance_cents into v_initial from public.workspaces w where w.id = p_workspace;

  select coalesce(sum(t.amount_cents) filter (where t.kind = 'income'), 0),
         coalesce(sum(t.amount_cents) filter (where t.kind = 'expense'), 0)
    into v_all_income, v_all_expense
  from public.transactions t where t.workspace_id = p_workspace;

  v_cutoff := public.history_cutoff(p_workspace);
  v_from := greatest(p_from, coalesce(v_cutoff, p_from));

  if v_from <= p_to then
    select coalesce(sum(t.amount_cents) filter (where t.kind = 'income'), 0),
           coalesce(sum(t.amount_cents) filter (where t.kind = 'expense'), 0)
      into v_income, v_expense
    from public.transactions t
    where t.workspace_id = p_workspace and t.occurred_on between v_from and p_to;

    select coalesce(jsonb_agg(row_to_json(c) order by c.total_cents desc), '[]'::jsonb) into v_cats
    from (
      select t.category_id, cat.name, t.kind::text as kind, sum(t.amount_cents)::bigint as total_cents, count(*)::int as count
      from public.transactions t
      left join public.categories cat on cat.id = t.category_id and cat.workspace_id = t.workspace_id
      where t.workspace_id = p_workspace and t.occurred_on between v_from and p_to
      group by t.category_id, cat.name, t.kind
    ) c;
  end if;

  return jsonb_build_object(
    'balance_cents', v_initial + v_all_income - v_all_expense,
    'income_cents', v_income,
    'expense_cents', v_expense,
    'effective_from', v_from,
    'categories', v_cats
  );
end;
$$;

revoke all on function public.workspace_summary(uuid, date, date) from public, anon;
grant execute on function public.workspace_summary(uuid, date, date) to authenticated;
