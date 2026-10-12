-- Testes de cobrança: plano efetivo, concessão de período, idempotência e acesso restrito ao backend.
do $$
declare
  uk uuid := '00000000-0000-0000-0000-000000000020';
  ul uuid := '00000000-0000-0000-0000-000000000021';
  ws_k uuid; ws_l uuid; ok boolean; s record; first_until timestamptz;
begin
  insert into auth.users (id, email) values (uk, 'k@test'), (ul, 'l@test');
  perform test.login(uk);
  ws_k := public.create_workspace('personal', 'Pessoal K', 0);
  perform test.logout();
  perform test.login(ul);
  ws_l := public.create_workspace('personal', 'Pessoal L', 0);
  perform test.logout();

  ------------------------------------------------------------ plano efetivo
  perform test.check('começa no Free', public.workspace_plan(ws_k) = 'free');
  update public.subscriptions set plan_id = 'pro', status = 'active', access_until = null where workspace_id = ws_k;
  perform test.check('active sem prazo vale (ajuste manual)', public.workspace_plan(ws_k) = 'pro');
  update public.subscriptions set access_until = now() + interval '5 days' where workspace_id = ws_k;
  perform test.check('active dentro do prazo vale', public.workspace_plan(ws_k) = 'pro');
  update public.subscriptions set access_until = now() - interval '1 minute' where workspace_id = ws_k;
  perform test.check('active vencida cai no Free', public.workspace_plan(ws_k) = 'free');
  update public.subscriptions set status = 'past_due', access_until = now() + interval '3 days' where workspace_id = ws_k;
  perform test.check('past_due em carência mantém o plano', public.workspace_plan(ws_k) = 'pro');
  update public.subscriptions set access_until = now() - interval '1 second' where workspace_id = ws_k;
  perform test.check('past_due vencida cai no Free', public.workspace_plan(ws_k) = 'free');
  update public.subscriptions set status = 'canceled', access_until = now() + interval '10 days' where workspace_id = ws_k;
  perform test.check('cancelada mantém o plano até o fim do período pago', public.workspace_plan(ws_k) = 'pro');
  update public.subscriptions set status = 'canceled', access_until = null where workspace_id = ws_k;
  perform test.check('cancelada sem período cai no Free', public.workspace_plan(ws_k) = 'free');
  update public.subscriptions set status = 'incomplete', access_until = now() + interval '10 days' where workspace_id = ws_k;
  perform test.check('incomplete nunca concede plano', public.workspace_plan(ws_k) = 'free');
  update public.subscriptions set plan_id = 'free', status = 'active', access_until = null where workspace_id = ws_k;

  ------------------------------------------------------------ concessão de período
  ok := public.grant_paid_period(ws_k, 'pro', 30, 'payment-1', 'pix', true, null);
  perform test.check('primeira concessão é aplicada', ok);
  select * into s from public.subscriptions where workspace_id = ws_k;
  first_until := s.access_until;
  perform test.check('plano Pro ativo por ~30 dias via Pix',
    s.plan_id = 'pro' and s.status = 'active' and s.billing_mode = 'pix' and s.access_until > now() + interval '29 days' and s.access_until <= now() + interval '30 days');
  perform test.check('plano efetivo passa a Pro', public.workspace_plan(ws_k) = 'pro');
  ok := public.grant_paid_period(ws_k, 'pro', 30, 'payment-1', 'pix', true, null);
  perform test.check('mesmo pagamento não é aplicado duas vezes', not ok);
  perform test.check('período não mudou no reenvio', (select access_until from public.subscriptions where workspace_id = ws_k) = first_until);
  ok := public.grant_paid_period(ws_k, 'pro', 30, 'payment-2', 'pix', true, null);
  perform test.check('novo pagamento do mesmo plano soma ao período restante', ok and (select access_until from public.subscriptions where workspace_id = ws_k) > first_until + interval '29 days');
  ok := public.grant_paid_period(ws_k, 'enterprise', 30, 'payment-3', 'pix', true, null);
  perform test.check('mudar de plano não soma período (começa agora)',
    ok and (select plan_id = 'enterprise' and access_until <= now() + interval '30 days' from public.subscriptions where workspace_id = ws_k));
  ok := public.grant_paid_period(ws_k, 'pro', 33, 'card-1', 'card', false, 'preapproval-abc');
  perform test.check('sem soma: período recomeça de agora', ok and (select access_until <= now() + interval '33 days' and provider_subscription_id = 'preapproval-abc' and billing_mode = 'card' from public.subscriptions where workspace_id = ws_k));
  perform test.check('eventos de concessão registrados', (select count(*) from public.payment_events where topic = 'grant') = 4);
  perform test.fails(format($f$ select public.grant_paid_period(%L, 'free', 30, 'x', 'pix', true, null) $f$, ws_k), 'INVALID_GRANT');
  perform test.fails(format($f$ select public.grant_paid_period(%L, 'pro', 0, 'x', 'pix', true, null) $f$, ws_k), 'INVALID_GRANT');
  perform test.fails(format($f$ select public.grant_paid_period(%L, 'pro', 30, 'x', 'boleto', true, null) $f$, ws_k), 'INVALID_GRANT');
  perform test.fails(format($f$ select public.grant_paid_period(%L, 'pro', 30, 'y', 'pix', true, null) $f$, gen_random_uuid()), 'NOT_FOUND');

  ------------------------------------------------------------ estado da assinatura recorrente
  perform public.apply_subscription_update(ws_k, 'pro', 'canceled', now() + interval '7 days', true, 'preapproval-abc', 'card');
  select * into s from public.subscriptions where workspace_id = ws_k;
  perform test.check('cancelamento no fim do ciclo registrado', s.status = 'canceled' and s.cancel_at_period_end and public.workspace_plan(ws_k) = 'pro');
  perform test.fails(format($f$ select public.apply_subscription_update(%L, 'pro', 'active', null, false, 'x', 'pix') $f$, gen_random_uuid()), 'NOT_FOUND');

  ------------------------------------------------------------ eventos
  perform test.check('evento novo é registrado', public.record_payment_event('mercadopago', 'req-1', 'payment', '123', 'ignored'));
  perform test.check('evento repetido é detectado', not public.record_payment_event('mercadopago', 'req-1', 'payment', '123', 'ignored'));

  ------------------------------------------------------------ acesso restrito ao backend
  perform test.login(uk);
  perform test.fails(format($f$ select public.grant_paid_period(%L, 'enterprise', 30, 'hack', 'pix', true, null) $f$, ws_k), 'permission denied');
  perform test.fails(format($f$ select public.apply_subscription_update(%L, 'enterprise', 'active', null, false, 'x', 'card') $f$, ws_k), 'permission denied');
  perform test.fails($f$ select public.record_payment_event('mercadopago', 'k', 't', 'r', null) $f$, 'permission denied');
  perform test.fails($f$ select * from public.payment_events $f$, 'permission denied');
  perform test.fails($f$ select * from public.billing_checkouts $f$, 'permission denied');
  perform test.fails(format($f$ update public.subscriptions set plan_id = 'enterprise' where workspace_id = %L $f$, ws_k), 'permission denied');
  perform test.fails(format($f$ update public.subscriptions set access_until = now() + interval '10 years' where workspace_id = %L $f$, ws_k), 'permission denied');
  perform test.check('membro lê a própria assinatura', (select count(*) from public.subscriptions where workspace_id = ws_k) = 1);
  perform test.logout();
  perform test.login(ul);
  perform test.check('outro usuário não lê a assinatura alheia', (select count(*) from public.subscriptions where workspace_id = ws_k) = 0);
  perform test.logout();
  execute 'set local role anon';
  perform test.fails(format($f$ select public.grant_paid_period(%L, 'pro', 30, 'z', 'pix', true, null) $f$, ws_k), 'permission denied');
  perform test.logout();
  execute 'set local role service_role';
  perform test.check('service_role consegue chamar as funções de cobrança', public.record_payment_event('mercadopago', 'req-svc', 'payment', '9', null));
  perform test.logout();

  raise notice 'COBRANCA: TODOS OS TESTES PASSARAM';
end $$;
