// Confirma, junto ao Mercado Pago, as compras recentes do espaço de trabalho do usuário.
// É chamada quando o cliente volta do pagamento (e pelo botão "verificar agora"), sem depender do webhook.
import { syncWorkspace } from '../_shared/billing-flow.ts';
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

  let paymentId: string | undefined;
  try {
    const body = (await req.json()) as { paymentId?: unknown };
    if (typeof body.paymentId === 'string' && /^\d{1,20}$/.test(body.paymentId)) paymentId = body.paymentId;
  } catch {
    /* sem corpo: segue só com a busca pelas compras recentes */
  }

  try {
    const results = await syncWorkspace(
      {
        mp: createMpClient(env('MP_ACCESS_TOKEN')),
        db: createBillingDb(serviceClient()),
        now: () => new Date(),
        log: (message, extra) => console.warn(message, JSON.stringify(extra ?? {})),
      },
      ws.id,
      { paymentId },
    );
    console.log('sync-billing', JSON.stringify(results));
    const debug = Deno.env.get('MP_SANDBOX') === 'true';
    return json({ ok: true, ...(debug ? { debug: results } : {}) }, 200, cors);
  } catch (e) {
    console.error('sync-billing falhou', String(e));
    return json({ error: 'PROVIDER_ERROR' }, 502, cors);
  }
});
