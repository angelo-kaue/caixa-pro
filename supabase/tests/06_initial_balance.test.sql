-- Testes de set_initial_balance (roda depois de rls_isolation.test.sql, que cria o schema "test").
do $$
declare
  ug uuid := '00000000-0000-0000-0000-000000006601';
  uh uuid := '00000000-0000-0000-0000-000000006602';
  ws uuid; s jsonb;
  v_m date := date_trunc('month', current_date)::date;
begin
  insert into auth.users (id, email) values (ug, 'g6@test'), (uh, 'h6@test');

  perform test.login(ug);
  ws := public.create_workspace('personal', 'Pessoal G', 10000);
  insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on)
  values (ws, 'income', 5000, 'Salário', v_m), (ws, 'expense', 2000, 'Mercado', v_m);

  perform public.set_initial_balance(ws, 25000);
  perform test.check('saldo inicial foi corrigido', (select initial_balance_cents from public.workspaces where id = ws) = 25000);
  s := public.workspace_summary(ws, v_m, (v_m + interval '1 month - 1 day')::date);
  perform test.check('o saldo recalcula com o novo valor inicial', (s->>'balance_cents')::bigint = 25000 + 5000 - 2000);
  perform test.check('lançamentos não mudam', (s->>'income_cents')::bigint = 5000 and (s->>'expense_cents')::bigint = 2000);

  perform public.set_initial_balance(ws, 0);
  perform test.check('aceita zerar', (select initial_balance_cents from public.workspaces where id = ws) = 0);

  perform test.fails(format($f$ select public.set_initial_balance(%L, 100000000000) $f$, ws), 'INVALID_BALANCE');
  perform test.fails(format($f$ select public.set_initial_balance(%L, null) $f$, ws), 'INVALID_BALANCE');
  perform test.fails(format($f$ update public.workspaces set initial_balance_cents = 1 where id = %L $f$, ws), 'permission denied');
  perform test.logout();

  -- outro usuário não altera o espaço alheio
  perform test.login(uh);
  perform test.fails(format($f$ select public.set_initial_balance(%L, 1) $f$, ws), 'FORBIDDEN');
  perform test.logout();
  perform test.check('valor do dono não foi tocado', (select initial_balance_cents from public.workspaces where id = ws) = 0);

  -- anônimo não executa
  execute 'set local role anon';
  perform test.fails(format($f$ select public.set_initial_balance(%L, 1) $f$, ws), 'permission denied');
  perform test.logout();
end $$;
