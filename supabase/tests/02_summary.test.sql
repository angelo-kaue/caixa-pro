-- Testes de workspace_summary (roda depois de rls_isolation.test.sql, que cria o schema "test").
do $$
declare
  ue uuid := '00000000-0000-0000-0000-00000000000e';
  uf uuid := '00000000-0000-0000-0000-00000000000f';
  ws_e uuid; cat_t uuid; s jsonb;
  v_m date := date_trunc('month', current_date)::date;
begin
  insert into auth.users (id, email) values (ue, 'e@test'), (uf, 'f@test');

  perform test.login(ue);
  ws_e := public.create_workspace('personal', 'Pessoal E', 100000);
  select id into cat_t from public.categories where workspace_id = ws_e and name = 'Transporte';
  insert into public.transactions (workspace_id, kind, amount_cents, description, category_id, occurred_on) values
    (ws_e, 'income', 50000, 'Salário', null, v_m),
    (ws_e, 'expense', 2000, 'Uber', cat_t, v_m),
    (ws_e, 'expense', 3000, 'Uber 2', cat_t, v_m),
    (ws_e, 'expense', 1500, 'Sem categoria', null, v_m);
  s := public.workspace_summary(ws_e, v_m, (v_m + interval '1 month - 1 day')::date);
  perform test.check('saldo = inicial + receitas - despesas', (s->>'balance_cents')::bigint = 100000 + 50000 - 6500);
  perform test.check('receitas do período', (s->>'income_cents')::bigint = 50000);
  perform test.check('despesas do período', (s->>'expense_cents')::bigint = 6500);
  perform test.check('categorias agregadas (3 grupos)', jsonb_array_length(s->'categories') = 3);
  perform test.check('maior categoria vem primeiro', (s->'categories'->0->>'total_cents')::bigint = 50000);
  perform test.check('Transporte soma 5000', (select (e->>'total_cents')::bigint from jsonb_array_elements(s->'categories') e where e->>'name' = 'Transporte') = 5000);
  perform test.fails(format($f$ select public.workspace_summary(%L, %L, %L) $f$, ws_e, v_m, v_m - 1), 'INVALID_PERIOD');
  perform test.logout();

  -- outro usuário não consegue resumir o espaço alheio
  perform test.login(uf);
  perform test.fails(format($f$ select public.workspace_summary(%L, %L, %L) $f$, ws_e, v_m, v_m), 'FORBIDDEN');
  perform test.logout();
  execute 'set local role anon';
  perform test.fails(format($f$ select public.workspace_summary(%L, %L, %L) $f$, ws_e, v_m, v_m), 'permission denied');
  perform test.logout();

  -- plano Pro aceita lançamento antigo; após downgrade o saldo continua contando, mas o período não exibe
  update public.subscriptions set plan_id = 'pro' where workspace_id = ws_e;
  perform test.login(ue);
  insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on)
    values (ws_e, 'income', 10000, 'Antigo', (v_m - interval '8 months')::date);
  perform test.logout();
  update public.subscriptions set plan_id = 'free' where workspace_id = ws_e;
  perform test.login(ue);
  s := public.workspace_summary(ws_e, (v_m - interval '9 months')::date, (v_m - interval '7 months')::date);
  perform test.check('período fora da janela do Free vem zerado', (s->>'income_cents')::bigint = 0 and jsonb_array_length(s->'categories') = 0);
  perform test.check('saldo continua incluindo dados preservados', (s->>'balance_cents')::bigint = 100000 + 50000 + 10000 - 6500);
  perform test.logout();
  raise notice 'RESUMO: TODOS OS TESTES PASSARAM';
end $$;
