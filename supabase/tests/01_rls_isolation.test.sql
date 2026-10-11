-- Testes de isolamento (RLS), limites do plano e integridade. Roda em um banco descartável.
-- Falha (e aborta) na primeira verificação que não passar.
create schema test;
create function test.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function test.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
create function test.fails(p_sql text, p_expect text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm like '%' || p_expect || '%' then return; end if;
    raise exception 'FALHA: erro inesperado "%" (esperado conter "%") em: %', sqlerrm, p_expect, p_sql;
  end;
  raise exception 'FALHA: deveria ter falhado com "%": %', p_expect, p_sql;
end $$;
create function test.check(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FALHA: %', p_name; end if;
  raise notice 'PASS: %', p_name;
end $$;
grant usage on schema test to anon, authenticated;
grant execute on all functions in schema test to anon, authenticated;

do $$
declare
  ua uuid := '00000000-0000-0000-0000-00000000000a';
  ub uuid := '00000000-0000-0000-0000-00000000000b';
  uc uuid := '00000000-0000-0000-0000-00000000000c';
  ud uuid := '00000000-0000-0000-0000-00000000000d';
  ws_a uuid; ws_b uuid; ws_c uuid;
  cat_a uuid; cat_b uuid; tx_a uuid; tx_b uuid;
  n integer;
  v_m date := date_trunc('month', current_date)::date;
begin
  insert into auth.users (id, email) values (ua, 'a@test'), (ub, 'b@test'), (uc, 'c@test'), (ud, 'd@test');

  ---------------------------------------------------------------- criação de espaço
  perform test.login(ua);
  ws_a := public.create_workspace('personal', '  Pessoal A  ', 150000);
  perform test.check('A cria espaço de trabalho', ws_a is not null);
  perform test.check('nome é aparado', (select name from public.workspaces where id = ws_a) = 'Pessoal A');
  perform test.check('12 categorias padrão (pessoal)', (select count(*) from public.categories where workspace_id = ws_a) = 12);
  perform test.check('A é admin do espaço', (select role from public.workspace_members where workspace_id = ws_a and user_id = ua) = 'admin');
  perform test.check('plano efetivo inicial é Free', public.workspace_plan(ws_a) = 'free');
  perform test.fails($f$ select public.create_workspace('personal', 'Outro', 0) $f$, 'WORKSPACE_ALREADY_EXISTS');
  perform test.fails($f$ select public.create_workspace('personal', '   ', 0) $f$, 'INVALID_NAME');
  perform test.logout();

  perform test.login(ub);
  ws_b := public.create_workspace('business', 'Loja B', 0);
  perform test.check('espaço de negócio tem 15 categorias', (select count(*) from public.categories where workspace_id = ws_b) = 15);
  perform test.logout();

  perform test.login(ud);
  perform test.fails($f$ select public.create_workspace('personal', 'X', 100000000000) $f$, 'INVALID_BALANCE');
  perform test.logout();

  execute 'set local role anon';
  perform test.fails($f$ select public.create_workspace('personal', 'X', 0) $f$, 'permission denied');
  perform test.fails($f$ select * from public.transactions $f$, 'permission denied');
  perform test.fails($f$ select * from public.workspaces $f$, 'permission denied');
  perform test.logout();

  ---------------------------------------------------------------- A registra transação
  perform test.login(ua);
  select id into cat_a from public.categories where workspace_id = ws_a and name = 'Transporte';
  insert into public.transactions (workspace_id, kind, amount_cents, description, category_id, occurred_on)
    values (ws_a, 'expense', 5000, 'Uber', cat_a, v_m) returning id into tx_a;
  perform test.check('created_by preenchido pelo servidor', (select created_by from public.transactions where id = tx_a) = ua);
  perform test.fails(format($f$ insert into public.transactions (workspace_id, kind, amount_cents, description, created_by) values (%L, 'expense', 100, 'forjado', %L) $f$, ws_a, ub), 'row-level security');
  perform test.fails(format($f$ insert into public.transactions (workspace_id, kind, amount_cents, description) values (%L, 'expense', 0, 'zero') $f$, ws_a), 'check constraint');
  perform test.fails(format($f$ insert into public.transactions (workspace_id, kind, amount_cents, description) values (%L, 'expense', -5, 'negativo') $f$, ws_a), 'check constraint');
  perform test.fails(format($f$ insert into public.transactions (workspace_id, kind, amount_cents, description) values (%L, 'expense', 100000000000, 'enorme') $f$, ws_a), 'check constraint');
  perform test.fails(format($f$ insert into public.transactions (workspace_id, kind, amount_cents, description) values (%L, 'expense', 100, '   ') $f$, ws_a), 'check constraint');
  update public.workspaces set name = 'Renomeado' where id = ws_a;
  get diagnostics n = row_count;
  perform test.check('admin renomeia o próprio espaço', n = 1);
  perform test.fails(format($f$ update public.workspaces set owner_id = %L where id = %L $f$, ub, ws_a), 'permission denied');
  perform test.fails(format($f$ update public.subscriptions set plan_id = 'pro' where workspace_id = %L $f$, ws_a), 'permission denied');
  perform test.fails(format($f$ insert into public.workspace_members (workspace_id, user_id, role) values (%L, %L, 'admin') $f$, ws_a, ub), 'permission denied');
  -- categorias do sistema são imutáveis; personalizadas são permitidas
  delete from public.categories where id = cat_a; get diagnostics n = row_count;
  perform test.check('categoria do sistema não pode ser excluída', n = 0);
  update public.categories set name = 'Hack' where id = cat_a; get diagnostics n = row_count;
  perform test.check('categoria do sistema não pode ser renomeada', n = 0);
  perform test.fails(format($f$ insert into public.categories (workspace_id, name, kind, is_system) values (%L, 'Falsa', 'expense', true) $f$, ws_a), 'row-level security');
  insert into public.categories (workspace_id, name, kind) values (ws_a, 'Pets', 'expense');
  perform test.check('categoria personalizada é permitida', (select count(*) from public.categories where workspace_id = ws_a and name = 'Pets') = 1);
  insert into public.category_rules (workspace_id, keyword, category_id) values (ws_a, 'uber', cat_a);
  perform test.check('regra de classificação salva', (select count(*) from public.category_rules where workspace_id = ws_a) = 1);
  perform test.fails(format($f$ insert into public.category_rules (workspace_id, keyword, category_id) values (%L, 'Uber99', %L) $f$, ws_a, cat_a), 'check constraint');
  perform test.logout();

  ---------------------------------------------------------------- isolamento: B contra A
  perform test.login(ub);
  select id into cat_b from public.categories where workspace_id = ws_b and name = 'Fornecedores';
  perform test.check('B não enxerga transações de A', (select count(*) from public.transactions where workspace_id = ws_a) = 0);
  perform test.check('B não enxerga o espaço de A', (select count(*) from public.workspaces where id = ws_a) = 0);
  perform test.check('B não enxerga membros de A', (select count(*) from public.workspace_members where workspace_id = ws_a) = 0);
  perform test.check('B não enxerga categorias de A', (select count(*) from public.categories where workspace_id = ws_a) = 0);
  perform test.check('B não enxerga regras de A', (select count(*) from public.category_rules where workspace_id = ws_a) = 0);
  perform test.check('B não enxerga assinatura de A', (select count(*) from public.subscriptions where workspace_id = ws_a) = 0);
  perform test.check('B enxerga só o próprio espaço', (select count(*) from public.workspaces) = 1);
  perform test.fails(format($f$ insert into public.transactions (workspace_id, kind, amount_cents, description) values (%L, 'expense', 100, 'invasão') $f$, ws_a), 'FORBIDDEN');
  perform test.fails(format($f$ insert into public.categories (workspace_id, name, kind) values (%L, 'Invasora', 'expense') $f$, ws_a), 'row-level security');
  perform test.fails(format($f$ insert into public.category_rules (workspace_id, keyword, category_id) values (%L, 'x', %L) $f$, ws_a, cat_a), 'row-level security');
  update public.transactions set description = 'hack' where id = tx_a; get diagnostics n = row_count;
  perform test.check('B não atualiza transação de A', n = 0);
  delete from public.transactions where id = tx_a; get diagnostics n = row_count;
  perform test.check('B não exclui transação de A', n = 0);
  update public.workspaces set name = 'hack' where id = ws_a; get diagnostics n = row_count;
  perform test.check('B não renomeia espaço de A', n = 0);
  -- categoria de outro espaço não pode ser usada
  perform test.fails(format($f$ insert into public.transactions (workspace_id, kind, amount_cents, description, category_id) values (%L, 'expense', 100, 'x', %L) $f$, ws_b, cat_a), 'foreign key');
  -- mover transação própria para o espaço de A é bloqueado
  insert into public.transactions (workspace_id, kind, amount_cents, description, category_id, occurred_on, idempotency_key)
    values (ws_b, 'expense', 2500, 'Fornecedor', cat_b, v_m, 'aaaaaaaa-0000-0000-0000-000000000001') returning id into tx_b;
  perform test.fails(format($f$ update public.transactions set workspace_id = %L where id = %L $f$, ws_a, tx_b), 'FORBIDDEN');
  perform test.fails(format($f$ update public.transactions set created_by = %L where id = %L $f$, ua, tx_b), 'CREATED_BY_IMMUTABLE');
  -- idempotência
  perform test.fails(format($f$ insert into public.transactions (workspace_id, kind, amount_cents, description, idempotency_key) values (%L, 'expense', 2500, 'Fornecedor', 'aaaaaaaa-0000-0000-0000-000000000001') $f$, ws_b), 'duplicate key');
  update public.transactions set amount_cents = 2600 where id = tx_b; get diagnostics n = row_count;
  perform test.check('B edita a própria transação', n = 1);
  delete from public.transactions where id = tx_b; get diagnostics n = row_count;
  perform test.check('B exclui a própria transação', n = 1);
  perform test.logout();

  perform test.login(ua);
  perform test.check('A ainda enxerga a própria transação', (select count(*) from public.transactions where id = tx_a) = 1);
  perform test.check('A lê o catálogo de planos', (select count(*) from public.plans) = 3);
  perform test.logout();

  ---------------------------------------------------------------- limites do Free
  perform test.login(uc);
  ws_c := public.create_workspace('personal', 'Pessoal C', 0);
  perform test.check('histórico do Free começa 2 meses antes do atual', public.history_cutoff(ws_c) = (v_m - interval '2 months')::date);
  insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on)
    select ws_c, 'expense', 100, 'lote ' || g, v_m from generate_series(1, 100) g;
  perform test.check('100 lançamentos no mês são aceitos', (select count(*) from public.transactions where workspace_id = ws_c) = 100);
  perform test.fails(format($f$ insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on) values (%L, 'expense', 100, 'excedente', %L) $f$, ws_c, v_m), 'MONTHLY_LIMIT_REACHED');
  insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on)
    values (ws_c, 'expense', 100, 'mês seguinte', (v_m + interval '1 month')::date);
  perform test.check('o limite é por mês: mês seguinte aceita', true);
  insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on)
    values (ws_c, 'expense', 100, 'dois meses atrás', (v_m - interval '2 months')::date);
  perform test.check('lançamento dentro da janela de 3 meses é aceito', true);
  perform test.fails(format($f$ insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on) values (%L, 'expense', 100, 'antigo', %L) $f$, ws_c, (v_m - interval '3 months')::date), 'HISTORY_LIMIT');
  perform test.logout();

  -- upgrade para Pro (feito pelo backend/superusuário): limites caem
  update public.subscriptions set plan_id = 'pro' where workspace_id = ws_c;
  perform test.login(uc);
  insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on)
    values (ws_c, 'expense', 100, 'após upgrade', v_m);
  perform test.check('Pro aceita o 101º lançamento', (select count(*) from public.transactions where workspace_id = ws_c and occurred_on = v_m) = 101);
  insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on)
    values (ws_c, 'income', 900, 'histórico antigo', (v_m - interval '8 months')::date);
  perform test.check('Pro aceita lançamento antigo', true);
  perform test.logout();

  -- downgrade: dados preservados, mas visibilidade volta à janela do Free
  update public.subscriptions set plan_id = 'free' where workspace_id = ws_c;
  perform test.check('dados antigos continuam armazenados após downgrade', (select count(*) from public.transactions where workspace_id = ws_c and occurred_on < v_m - interval '2 months') = 1);
  perform test.login(uc);
  perform test.check('Free não exibe dados fora da janela', (select count(*) from public.transactions where workspace_id = ws_c and occurred_on < v_m - interval '2 months') = 0);
  perform test.fails(format($f$ insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on) values (%L, 'expense', 100, 'bloqueado', %L) $f$, ws_c, v_m), 'MONTHLY_LIMIT_REACHED');
  perform test.logout();

  -- assinatura vencida cai no Free
  update public.subscriptions set plan_id = 'pro', status = 'past_due' where workspace_id = ws_c;
  perform test.check('assinatura past_due vale como Free', public.workspace_plan(ws_c) = 'free');
  update public.subscriptions set status = 'active' where workspace_id = ws_c;
  perform test.check('assinatura ativa vale o plano contratado', public.workspace_plan(ws_c) = 'pro');

  raise notice 'TODOS OS TESTES PASSARAM';
end $$;
