// Cancela a assinatura recorrente (cartão). O acesso continua até o fim do período já pago.
import { createMpClient } from '../_shared/mp-client.ts';
import { corsHeaders, createBillingDb, env, json, serviceClient, userClient } from '../_deno/runtime.ts';

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, cors);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'UNAUTHENTICATED' }, 401, cors);

  const user = userClient(authorization);
  const { data: auth, error: authError } = await user.auth.getUser();
  if (authError || !auth.user) return json({ error: 'UNAUTHENTICATED' }, 401, cors);

  const { data: ws } = await user.from('workspaces').select('id').limit(1).maybeSingle();
  if (!ws) return json({ error: 'NO_WORKSPACE' }, 404, cors);
  const { data: isAdmin } = await user.rpc('has_workspace_role', { p_workspace: ws.id, p_roles: ['admin'] });
  if (isAdmin !== true) return json({ error: 'FORBIDDEN' }, 403, cors);

  const db = createBillingDb(serviceClient());
  const sub = await db.getSubscription(ws.id);
  if (!sub || sub.billing_mode !== 'card' || !sub.provider_subscription_id || sub.status !== 'active') {
    return json({ error: 'NOTHING_TO_CANCEL' }, 409, cors);
  }

  try {
    await createMpClient(env('MP_ACCESS_TOKEN')).cancelPreapproval(sub.provider_subscription_id);
  } catch (e) {
    console.error('Mercado Pago recusou o cancelamento', String(e));
    return json({ error: 'PROVIDER_ERROR' }, 502, cors);
  }

  const plan = sub.plan_id === 'enterprise' ? 'enterprise' : 'pro';
  await db.applySubscription({
    workspaceId: ws.id,
    plan,
    status: 'canceled',
    accessUntil: sub.access_until ? new Date(sub.access_until) : null,
    cancelAtPeriodEnd: true,
    providerSubscriptionId: sub.provider_subscription_id,
    mode: 'card',
  });
  return json({ ok: true, accessUntil: sub.access_until }, 200, cors);
});
