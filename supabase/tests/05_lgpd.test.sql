-- Testes de LGPD: exportação só dos próprios dados e exclusão total em cascata.
do $$
declare
  um uuid := '00000000-0000-0000-0000-000000000030';
  un uuid := '00000000-0000-0000-0000-000000000031';
  ws_m uuid; ws_n uuid; cat uuid; x jsonb; n integer;
begin
  insert into auth.users (id, email) values (um, 'm@test'), (un, 'n@test');

  perform test.login(um);
  ws_m := public.create_workspace('business', 'Loja M', 12345);
  select id into cat from public.categories where workspace_id = ws_m and name = 'Vendas';
  insert into public.transactions (workspace_id, kind, amount_cents, description, category_id, occurred_on) values (ws_m, 'income', 5000, 'Venda secreta de M', cat, current_date);
  insert into public.bills (workspace_id, kind, description, amount_cents, due_on) values (ws_m, 'expense', 'Conta de M', 700, current_date);
  insert into public.category_rules (workspace_id, keyword, category_id) values (ws_m, 'venda secreta', cat);
  perform test.logout();

  perform test.login(un);
  ws_n := public.create_workspace('personal', 'Pessoal N', 0);
  insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on) values (ws_n, 'expense', 100, 'Gasto de N', current_date);
  perform test.logout();

  ------------------------------------------------------------ exportação
  perform test.login(um);
  x := public.export_my_data();
  perform test.check('exporta o usuário e o espaço', x->'user'->>'email' = 'm@test' and x->'workspace'->>'name' = 'Loja M' and (x->'workspace'->>'initial_balance_cents')::bigint = 12345);
  perform test.check('exporta lançamentos com o nome da categoria', jsonb_array_length(x->'transactions') = 1 and x->'transactions'->0->>'category' = 'Vendas' and x->'transactions'->0->>'description' = 'Venda secreta de M');
  perform test.check('exporta contas, regras e categorias', jsonb_array_length(x->'bills') = 1 and jsonb_array_length(x->'classification_rules') = 1 and jsonb_array_length(x->'categories') = 15);
  perform test.check('exporta a assinatura sem identificadores do provedor', x->'subscription' ? 'plan' and not (x->'subscription' ? 'provider_subscription_id'));
  perform test.check('a exportação não contém dados de outro usuário', position('Gasto de N' in x::text) = 0 and position('n@test' in x::text) = 0);
  perform test.logout();

  perform test.login(un);
  x := public.export_my_data();
  perform test.check('N exporta só o que é dele', position('Venda secreta' in x::text) = 0 and jsonb_array_length(x->'transactions') = 1);
  perform test.logout();

  execute 'set local role anon';
  perform test.fails('select public.export_my_data()', 'permission denied');
  perform test.logout();
  perform test.fails('select public.export_my_data()', 'NOT_AUTHENTICATED'); -- superusuário sem usuário logado

  ------------------------------------------------------------ exclusão em cascata
  insert into public.billing_checkouts (workspace_id, plan_id, mode, created_by) values (ws_m, 'pro', 'card', um);
  delete from auth.users where id = um;
  select (select count(*) from public.workspaces where id = ws_m)
       + (select count(*) from public.workspace_members where workspace_id = ws_m)
       + (select count(*) from public.subscriptions where workspace_id = ws_m)
       + (select count(*) from public.categories where workspace_id = ws_m)
       + (select count(*) from public.transactions where workspace_id = ws_m)
       + (select count(*) from public.bills where workspace_id = ws_m)
       + (select count(*) from public.category_rules where workspace_id = ws_m)
       + (select count(*) from public.billing_checkouts where workspace_id = ws_m) into n;
  perform test.check('excluir o usuário apaga todos os dados dele em cascata', n = 0);
  perform test.check('os dados de outro usuário permanecem', (select count(*) from public.transactions where workspace_id = ws_n) = 1);

  raise notice 'LGPD: TODOS OS TESTES PASSARAM';
end $$;
