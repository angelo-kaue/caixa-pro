// Cria a cobrança no Mercado Pago. Exige usuário autenticado (JWT) e administrador do espaço de trabalho.
// O preço vem SEMPRE da tabela `plans`, nunca do navegador.
import { buildPreapprovalBody, buildPreferenceBody, isBillingMode, isSellablePlan, normalizePayerEmail } from '../_shared/billing-core.ts';
import { MpError, createMpClient } from '../_shared/mp-client.ts';
import { corsHeaders, createBillingDb, env, json, serviceClient, userClient } from '../_deno/runtime.ts';

const PLAN_NAMES = { pro: 'Pro', enterprise: 'Enterprise' } as const;

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, cors);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'UNAUTHENTICATED' }, 401, cors);

  const user = userClient(authorization);
  const { data: auth, error: authError } = await user.auth.getUser();
  const email = auth.user?.email;
  if (authError || !auth.user || !email) return json({ error: 'UNAUTHENTICATED' }, 401, cors);

  let input: { plan?: unknown; mode?: unknown; payerEmail?: unknown } = {};
  try {
    input = await req.json();
  } catch {
    /* corpo inválido cai na validação abaixo */
  }
  if (!isSellablePlan(input.plan) || !isBillingMode(input.mode)) return json({ error: 'INVALID_REQUEST' }, 400, cors);
  const { plan, mode } = input;
  if (mode === 'card' && Deno.env.get('CARD_ENABLED') === 'false') return json({ error: 'CARD_DISABLED' }, 409, cors);
  // No cartão, a assinatura fica ligada ao e-mail da conta Mercado Pago de QUEM PAGA (pode ser diferente do e-mail do CaixaPro).
  const chosenEmail = mode === 'card' ? normalizePayerEmail(input.payerEmail, email) : email;
  if (!chosenEmail) return json({ error: 'INVALID_REQUEST' }, 400, cors);

  const { data: ws } = await user.from('workspaces').select('id').limit(1).maybeSingle();
  if (!ws) return json({ error: 'NO_WORKSPACE' }, 404, cors);
  const { data: isAdmin } = await user.rpc('has_workspace_role', { p_workspace: ws.id, p_roles: ['admin'] });
  if (isAdmin !== true) return json({ error: 'FORBIDDEN' }, 403, cors);

  const sb = serviceClient();
  const db = createBillingDb(sb);

  const price = await db.getPlanPrice(plan);
  if (!price || price.price_cents <= 0) return json({ error: 'INVALID_REQUEST' }, 400, cors);

  const sub = await db.getSubscription(ws.id);
  const stillActive = sub?.status === 'active' && sub.access_until !== null && new Date(sub.access_until) > new Date();
  if (mode === 'card' && stillActive && sub?.billing_mode === 'card' && sub.plan_id === plan) {
    return json({ error: 'ALREADY_SUBSCRIBED' }, 409, cors);
  }

  // Freio simples contra abuso: no máximo 5 cobranças criadas por minuto por espaço de trabalho.
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await sb.from('billing_checkouts').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id).gte('created_at', since);
  if ((count ?? 0) >= 5) return json({ error: 'TOO_MANY_REQUESTS' }, 429, cors);

  const { data: checkout, error: insertError } = await sb
    .from('billing_checkouts')
    .insert({ workspace_id: ws.id, plan_id: plan, mode, created_by: auth.user.id })
    .select('id')
    .single();
  if (insertError || !checkout) {
    console.error('Falha ao registrar a compra', String(insertError?.message));
    return json({ error: 'INTERNAL' }, 500, cors);
  }

  const backUrl = `${env('APP_URL').split(',')[0]?.trim().replace(/\/$/, '')}/app/plano`;
  const sandbox = Deno.env.get('MP_SANDBOX') === 'true';
  // No modo de teste, o Mercado Pago só aceita comprador de teste quando o vendedor é de teste.
  // MP_TEST_PAYER_EMAIL = e-mail da conta de teste COMPRADORA. Em produção usa o e-mail do próprio usuário.
  const payerEmail = sandbox ? (Deno.env.get('MP_TEST_PAYER_EMAIL') || chosenEmail) : chosenEmail;
  const mp = createMpClient(env('MP_ACCESS_TOKEN'));

  try {
    let url: string;
    let providerRef: string;
    if (mode === 'card') {
      const created = await mp.createPreapproval(
        buildPreapprovalBody({ reason: `CaixaPro ${PLAN_NAMES[plan]}`, payerEmail, externalReference: checkout.id, amountCents: price.price_cents, backUrl }),
      );
      url = created.init_point;
      providerRef = created.id;
    } else {
      const created = await mp.createPreference(
        buildPreferenceBody({
          title: `CaixaPro ${PLAN_NAMES[plan]} (30 dias)`,
          amountCents: price.price_cents,
          externalReference: checkout.id,
          notificationUrl: `${env('SUPABASE_URL')}/functions/v1/mp-webhook`,
          backUrl,
        }),
      );
      url = created.init_point;
      providerRef = created.id;
    }
    await sb.from('billing_checkouts').update({ provider_ref: providerRef }).eq('id', checkout.id);
    return json({ url }, 200, cors);
  } catch (e) {
    const status = e instanceof MpError ? e.status : null;
    const detail = e instanceof MpError ? e.detail : null;
    console.error('Mercado Pago recusou a criação da cobrança', JSON.stringify({ mode, status, detail, sandbox }));
    // O detalhe técnico só volta para a tela no modo de teste.
    return json({ error: 'PROVIDER_ERROR', ...(sandbox && detail ? { detail } : {}) }, 502, cors);
  }
});
