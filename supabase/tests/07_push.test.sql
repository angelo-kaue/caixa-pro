-- Testes dos lembretes por notificação (roda depois de rls_isolation.test.sql, que cria o schema "test").
do $$
declare
  ua uuid := '00000000-0000-0000-0000-000000007001';
  ub uuid := '00000000-0000-0000-0000-000000007002';
  uc uuid := '00000000-0000-0000-0000-000000007003';
  ws_a uuid; ws_c uuid;
  ep1 text := 'https://fcm.googleapis.com/fcm/send/aaaaaaaaaaaaaaaaaaaa';
  ep2 text := 'https://updates.push.services.mozilla.com/wpush/v2/bbbbbbbbbbbbbbbb';
  k text := repeat('k', 87);
  a text := repeat('a', 22);
  n int; r record; sub_id uuid;
begin
  insert into auth.users (id, email) values (ua, 'a7@test'), (ub, 'b7@test'), (uc, 'c7@test');

  -- A e C têm espaço de trabalho; B não precisa
  perform test.login(ua);
  ws_a := public.create_workspace('personal', 'Espaço A', 0);
  perform public.save_push_subscription(ep1, k, a, 'Chrome Android');
  -- salvar de novo não duplica
  perform public.save_push_subscription(ep1, k, a, 'Chrome Android');
  perform test.logout();
  perform test.check('A salvou um aparelho e salvar de novo não duplica', (select count(*) from public.push_subscriptions where user_id = ua) = 1);
  perform test.login(ua);
  perform test.fails($f$ select public.save_push_subscription('https://evil.example.com/x/xxxxxxxxxxxxxxxxxxxxxxxx', repeat('k',87), repeat('a',22)) $f$, 'INVALID_ENDPOINT');
  perform test.fails($f$ select public.save_push_subscription('http://fcm.googleapis.com/fcm/send/aaaaaaaaaaaaaaaaaaaa', repeat('k',87), repeat('a',22)) $f$, 'INVALID_ENDPOINT');
  -- o cliente não lê nem altera a tabela diretamente
  perform test.fails('select * from public.push_subscriptions', 'permission denied');
  perform test.fails($f$ update public.push_subscriptions set failures = 0 $f$, 'permission denied');
  perform test.fails($f$ select * from public.reminder_targets(now()) $f$, 'permission denied');
  perform test.fails($f$ select public.record_push_results('{}', '{}', '{}') $f$, 'permission denied');
  perform test.logout();

  -- B entra no mesmo aparelho (mesmo endpoint): a inscrição passa a ser dele
  perform test.login(ub);
  perform public.save_push_subscription(ep1, k, a, 'Chrome Android');
  perform test.logout();
  perform test.check('o aparelho foi transferido para B', (select user_id from public.push_subscriptions where endpoint = ep1) = ub);

  -- B não apaga a inscrição de outro usuário
  perform test.login(ua);
  perform public.delete_push_subscription(ep1);
  perform test.logout();
  perform test.check('A não apaga o aparelho de B', (select count(*) from public.push_subscriptions where endpoint = ep1) = 1);
  perform test.login(ub);
  perform public.delete_push_subscription(ep1);
  perform test.logout();
  perform test.check('B apaga o próprio aparelho', (select count(*) from public.push_subscriptions where endpoint = ep1) = 0);

  -- limite de 10 aparelhos por usuário (os mais antigos saem)
  perform test.login(ua);
  for n in 1..12 loop
    perform public.save_push_subscription('https://fcm.googleapis.com/fcm/send/dispositivo' || lpad(n::text, 12, '0'), k, a);
  end loop;
  perform test.logout();
  perform test.check('no máximo 10 aparelhos por usuário', (select count(*) from public.push_subscriptions where user_id = ua) = 10);
  delete from public.push_subscriptions where user_id = ua;

  -- quem já lançou hoje não recebe o lembrete
  perform test.login(ua);
  perform public.save_push_subscription(ep1, k, a);
  perform test.logout();
  perform test.login(uc);
  ws_c := public.create_workspace('personal', 'Espaço C', 0);
  perform public.save_push_subscription(ep2, k, a);
  insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on)
  values (ws_c, 'expense', 1000, 'Café', current_date);
  perform test.logout();

  perform test.check('A (sem lançamento hoje) é alvo', exists (select 1 from public.reminder_targets(date_trunc('day', now())) where user_id = ua));
  perform test.check('C (lançou hoje) não é alvo', not exists (select 1 from public.reminder_targets(date_trunc('day', now())) where user_id = uc));
  perform test.check('depois de amanhã C volta a ser alvo', exists (select 1 from public.reminder_targets(now() + interval '1 day') where user_id = uc));

  -- resultados dos envios
  select id into sub_id from public.push_subscriptions where user_id = ua;
  perform public.record_push_results('{}', '{}', array[sub_id]);
  perform test.check('falha soma 1', (select failures from public.push_subscriptions where id = sub_id) = 1);
  perform public.record_push_results(array[sub_id], '{}', '{}');
  perform test.check('sucesso zera as falhas', (select failures from public.push_subscriptions where id = sub_id) = 0 and (select last_success_at from public.push_subscriptions where id = sub_id) is not null);
  for n in 1..5 loop
    perform public.record_push_results('{}', '{}', array[sub_id]);
  end loop;
  perform test.check('5 falhas seguidas removem o aparelho', not exists (select 1 from public.push_subscriptions where id = sub_id));
  select id into sub_id from public.push_subscriptions where user_id = uc;
  perform public.record_push_results('{}', array[sub_id], '{}');
  perform test.check('404/410 remove o aparelho', not exists (select 1 from public.push_subscriptions where id = sub_id));

  -- anônimo não executa
  execute 'set local role anon';
  perform test.fails($f$ select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/aaaaaaaaaaaaaaaaaaaa', repeat('k',87), repeat('a',22)) $f$, 'permission denied');
  perform test.logout();
end $$;
