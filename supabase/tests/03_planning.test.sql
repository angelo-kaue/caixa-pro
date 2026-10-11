-- Testes da Fase 3: orçamentos, metas, recorrências, contas a pagar/receber e série mensal.
do $$
declare
  ug uuid := '00000000-0000-0000-0000-000000000010';
  uh uuid := '00000000-0000-0000-0000-000000000011';
  ui uuid := '00000000-0000-0000-0000-000000000012';
  uj uuid := '00000000-0000-0000-0000-000000000013';
  ws_g uuid; ws_h uuid; ws_i uuid; ws_j uuid;
  cats uuid[]; cat_inc uuid; cat_h_exp uuid; cat_h_inc uuid;
  n integer; s jsonb; b_pay uuid; b_rec uuid; tx uuid; rid uuid; goal uuid;
  v_m date := date_trunc('month', current_date)::date;
begin
  insert into auth.users (id, email) values (ug, 'g@test'), (uh, 'h@test'), (ui, 'i@test'), (uj, 'j@test');

  ------------------------------------------------------------ orçamentos
  perform test.login(ug);
  ws_g := public.create_workspace('personal', 'Pessoal G', 0);
  select array_agg(id order by name) into cats from public.categories where workspace_id = ws_g and kind = 'expense';
  select id into cat_inc from public.categories where workspace_id = ws_g and kind = 'income' limit 1;
  insert into public.budgets (workspace_id, category_id, amount_cents) values (ws_g, cats[1], 10000), (ws_g, cats[2], 20000), (ws_g, cats[3], 30000);
  perform test.check('Free aceita 3 orçamentos ativos', (select count(*) from public.budgets where workspace_id = ws_g) = 3);
  perform test.fails(format($f$ insert into public.budgets (workspace_id, category_id, amount_cents) values (%L, %L, 100) $f$, ws_g, cats[4]), 'BUDGET_LIMIT_REACHED');
  perform test.fails(format($f$ insert into public.budgets (workspace_id, category_id, amount_cents) values (%L, %L, 100) $f$, ws_g, cat_inc), 'BUDGET_NEEDS_EXPENSE_CATEGORY');
  perform test.fails(format($f$ insert into public.budgets (workspace_id, category_id, amount_cents) values (%L, %L, 100) $f$, ws_g, cats[1]), 'BUDGET_ALREADY_EXISTS');
  perform test.fails(format($f$ update public.budgets set amount_cents = 0 where workspace_id = %L and category_id = %L $f$, ws_g, cats[1]), 'check constraint');
  perform test.logout();

  update public.subscriptions set plan_id = 'pro' where workspace_id = ws_g;
  perform test.login(ug);
  insert into public.budgets (workspace_id, category_id, amount_cents) values (ws_g, cats[4], 5000);
  perform test.check('Pro aceita o 4º orçamento', (select count(*) from public.budgets where workspace_id = ws_g and active) = 4);
  perform test.logout();

  update public.subscriptions set plan_id = 'free' where workspace_id = ws_g;
  perform test.login(ug);
  perform test.check('orçamentos preservados após downgrade', (select count(*) from public.budgets where workspace_id = ws_g) = 4);
  update public.budgets set active = false where workspace_id = ws_g and category_id = cats[4];
  perform test.fails(format($f$ update public.budgets set active = true where workspace_id = %L and category_id = %L $f$, ws_g, cats[4]), 'BUDGET_LIMIT_REACHED');
  perform test.fails(format($f$ insert into public.goals (workspace_id, name, target_cents) values (%L, 'Viagem', 100000) $f$, ws_g), 'FEATURE_NOT_AVAILABLE');
  perform test.fails(format($f$ insert into public.recurring_rules (workspace_id, kind, amount_cents, description, day_of_month) values (%L, 'expense', 100, 'Aluguel', 5) $f$, ws_g), 'FEATURE_NOT_AVAILABLE');
  perform test.fails(format($f$ select public.monthly_series(%L, 6) $f$, ws_g), 'FEATURE_NOT_AVAILABLE');
  perform test.check('Free: gerar recorrências não faz nada', public.generate_recurring(ws_g) = 0);
  perform test.logout();

  ------------------------------------------------------------ metas e recorrências (Pro)
  update public.subscriptions set plan_id = 'pro' where workspace_id = ws_g;
  perform test.login(ug);
  insert into public.goals (workspace_id, name, target_cents, target_date) values (ws_g, 'Viagem', 100000, current_date + 180) returning id into goal;
  update public.goals set current_cents = 25000 where id = goal;
  perform test.check('meta recebe aporte', (select current_cents from public.goals where id = goal) = 25000);
  perform test.fails(format($f$ update public.goals set current_cents = -1 where id = %L $f$, goal), 'check constraint');

  -- regra no dia 1, começando 3 meses atrás: 4 meses (m-3..m) já vencidos
  insert into public.recurring_rules (workspace_id, kind, amount_cents, description, day_of_month, start_on)
    values (ws_g, 'expense', 150000, 'Aluguel recorrente', 1, (v_m - interval '3 months')::date) returning id into rid;
  perform test.check('geração cria 4 lançamentos', public.generate_recurring(ws_g) = 4);
  perform test.check('lançamentos gerados existem', (select count(*) from public.transactions where workspace_id = ws_g and description = 'Aluguel recorrente') = 4);
  perform test.check('geração é idempotente', public.generate_recurring(ws_g) = 0);
  delete from public.transactions where workspace_id = ws_g and description = 'Aluguel recorrente' and occurred_on = v_m;
  perform test.check('apagar lançamento gerado não o recria', public.generate_recurring(ws_g) = 0 and
    (select count(*) from public.transactions where workspace_id = ws_g and description = 'Aluguel recorrente') = 3);

  -- dia 31 se ajusta ao último dia de cada mês
  insert into public.recurring_rules (workspace_id, kind, amount_cents, description, day_of_month, start_on)
    values (ws_g, 'expense', 1000, 'Conta dia 31', 31, (v_m - interval '3 months')::date);
  perform public.generate_recurring(ws_g);
  perform test.check('dia 31 vira o último dia do mês',
    (select count(*) from public.transactions t where t.workspace_id = ws_g and t.description = 'Conta dia 31') >= 3
    and not exists (select 1 from public.transactions t where t.workspace_id = ws_g and t.description = 'Conta dia 31'
      and extract(day from t.occurred_on) <> extract(day from (date_trunc('month', t.occurred_on) + interval '1 month - 1 day'))));

  -- data final respeitada
  insert into public.recurring_rules (workspace_id, kind, amount_cents, description, day_of_month, start_on, end_on)
    values (ws_g, 'income', 5000, 'Freela com fim', 1, (v_m - interval '3 months')::date, (v_m - interval '2 months')::date);
  perform test.check('data final limita a geração (2 meses)', public.generate_recurring(ws_g) = 2);
  perform test.fails(format($f$ insert into public.recurring_rules (workspace_id, kind, amount_cents, description, category_id, day_of_month) values (%L, 'income', 100, 'x', %L, 5) $f$, ws_g, cats[1]), 'CATEGORY_KIND_MISMATCH');
  perform test.fails(format($f$ insert into public.recurring_rules (workspace_id, kind, amount_cents, description, day_of_month) values (%L, 'income', 100, 'x', 32) $f$, ws_g), 'check constraint');
  perform test.logout();

  -- após downgrade: regras e metas ficam, mas nada novo é gerado
  update public.subscriptions set plan_id = 'free' where workspace_id = ws_g;
  perform test.login(ug);
  perform test.check('metas e regras preservadas após downgrade', (select count(*) from public.goals where workspace_id = ws_g) = 1 and (select count(*) from public.recurring_rules where workspace_id = ws_g) = 3);
  update public.goals set current_cents = 26000 where id = goal; get diagnostics n = row_count;
  perform test.check('meta existente continua editável no Free', n = 1);
  perform test.check('Free não gera recorrências', public.generate_recurring(ws_g) = 0);
  perform test.logout();

  ------------------------------------------------------------ série mensal
  perform test.login(ui);
  ws_i := public.create_workspace('personal', 'Pessoal I', 0);
  perform test.logout();
  update public.subscriptions set plan_id = 'pro' where workspace_id = ws_i;
  perform test.login(ui);
  insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on) values
    (ws_i, 'income', 100000, 'Salário', v_m),
    (ws_i, 'expense', 40000, 'Mercado', v_m),
    (ws_i, 'income', 20000, 'Freela', (v_m - interval '1 month')::date);
  s := public.monthly_series(ws_i, 3);
  perform test.check('série tem 3 meses', jsonb_array_length(s) = 3);
  perform test.check('mês atual: receitas 100000 e despesas 40000', (s->2->>'income_cents')::bigint = 100000 and (s->2->>'expense_cents')::bigint = 40000);
  perform test.check('mês anterior: receitas 20000', (s->1->>'income_cents')::bigint = 20000 and (s->1->>'expense_cents')::bigint = 0);
  perform test.check('mês sem dados vem zerado', (s->0->>'income_cents')::bigint = 0);
  perform test.check('meses em ordem crescente', (s->0->>'month') < (s->2->>'month'));
  perform test.fails(format($f$ select public.monthly_series(%L, 0) $f$, ws_i), 'INVALID_PERIOD');
  perform test.fails(format($f$ select public.monthly_series(%L, 25) $f$, ws_i), 'INVALID_PERIOD');
  perform test.logout();

  ------------------------------------------------------------ contas a pagar e a receber
  perform test.login(ug);
  perform test.fails(format($f$ insert into public.bills (workspace_id, kind, description, amount_cents, due_on) values (%L, 'expense', 'Luz', 1000, current_date) $f$, ws_g), 'BUSINESS_ONLY');
  perform test.logout();

  perform test.login(uh);
  ws_h := public.create_workspace('business', 'Loja H', 0);
  select id into cat_h_exp from public.categories where workspace_id = ws_h and name = 'Fornecedores';
  select id into cat_h_inc from public.categories where workspace_id = ws_h and name = 'Vendas';
  insert into public.bills (workspace_id, kind, description, amount_cents, due_on, category_id)
    values (ws_h, 'expense', 'Fornecedor X', 5000, current_date - 1, cat_h_exp) returning id into b_pay;
  insert into public.bills (workspace_id, kind, description, amount_cents, due_on, category_id)
    values (ws_h, 'income', 'Cliente Y', 3000, current_date + 1, cat_h_inc) returning id into b_rec;
  perform test.fails(format($f$ insert into public.bills (workspace_id, kind, description, amount_cents, due_on, category_id) values (%L, 'expense', 'Errada', 100, current_date, %L) $f$, ws_h, cat_h_inc), 'CATEGORY_KIND_MISMATCH');
  s := public.bills_overview(ws_h);
  perform test.check('visão geral: a pagar 5000 e a receber 3000', (s->>'payable_cents')::bigint = 5000 and (s->>'receivable_cents')::bigint = 3000);
  perform test.check('visão geral: atrasadas', (s->>'overdue_payable_cents')::bigint = 5000 and (s->>'overdue_receivable_cents')::bigint = 0 and (s->>'overdue_count')::int = 1);
  perform test.fails(format($f$ update public.bills set status = 'paid', paid_on = current_date where id = %L $f$, b_pay), 'permission denied');
  tx := public.settle_bill(b_pay, current_date);
  perform test.check('baixa cria o lançamento', (select count(*) from public.transactions where id = tx and amount_cents = 5000 and kind = 'expense') = 1);
  perform test.check('conta fica paga e vinculada', (select status = 'paid' and transaction_id = tx and paid_on = current_date from public.bills where id = b_pay));
  perform test.fails(format($f$ select public.settle_bill(%L, current_date) $f$, b_pay), 'ALREADY_PAID');
  perform test.fails(format($f$ update public.bills set amount_cents = 9999 where id = %L $f$, b_pay), 'BILL_PAID_LOCKED');
  perform test.check('visão geral após baixa', ((public.bills_overview(ws_h))->>'payable_cents')::bigint = 0);
  perform public.reopen_bill(b_pay);
  perform test.check('reabrir remove o lançamento e volta a pendente',
    (select count(*) from public.transactions where id = tx) = 0 and (select status = 'pending' and paid_on is null and transaction_id is null from public.bills where id = b_pay));
  perform test.fails(format($f$ select public.reopen_bill(%L) $f$, b_pay), 'NOT_PAID');
  perform test.logout();

  ------------------------------------------------------------ isolamento das novas tabelas
  perform test.login(uj);
  ws_j := public.create_workspace('business', 'Loja J', 0);
  perform test.check('J não vê orçamentos de G', (select count(*) from public.budgets where workspace_id = ws_g) = 0);
  perform test.check('J não vê metas de G', (select count(*) from public.goals where workspace_id = ws_g) = 0);
  perform test.check('J não vê recorrências de G', (select count(*) from public.recurring_rules where workspace_id = ws_g) = 0);
  perform test.check('J não vê contas de H', (select count(*) from public.bills where workspace_id = ws_h) = 0);
  perform test.fails(format($f$ select public.settle_bill(%L, current_date) $f$, b_pay), 'FORBIDDEN');
  perform test.fails(format($f$ select public.bills_overview(%L) $f$, ws_h), 'FORBIDDEN');
  perform test.fails(format($f$ select public.generate_recurring(%L) $f$, ws_g), 'FORBIDDEN');
  perform test.fails(format($f$ select public.monthly_series(%L, 3) $f$, ws_i), 'FORBIDDEN');
  perform test.fails(format($f$ insert into public.budgets (workspace_id, category_id, amount_cents) values (%L, %L, 100) $f$, ws_g, cats[5]), 'FORBIDDEN');
  perform test.fails(format($f$ insert into public.bills (workspace_id, kind, description, amount_cents, due_on) values (%L, 'expense', 'invasão', 100, current_date) $f$, ws_h), 'FORBIDDEN');
  delete from public.goals where id = goal; get diagnostics n = row_count;
  perform test.check('J não exclui meta de G', n = 0);
  perform test.fails('select * from public.recurring_runs', 'permission denied');
  perform test.logout();
  execute 'set local role anon';
  perform test.fails('select * from public.budgets', 'permission denied');
  perform test.fails('select * from public.bills', 'permission denied');
  perform test.logout();

  raise notice 'FASE 3: TODOS OS TESTES PASSARAM';
end $$;
