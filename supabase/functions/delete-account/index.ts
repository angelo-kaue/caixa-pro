// Exclui a conta do usuário (direito de eliminação da LGPD). Todos os dados caem em cascata no banco.
// Se houver assinatura de cartão ativa, ela é cancelada ANTES; se o cancelamento falhar, nada é excluído
// (para ninguém continuar sendo cobrado por uma conta que não existe mais).
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

  let confirm = '';
  try {
    const body = (await req.json()) as { confirm?: unknown };
    confirm = typeof body.confirm === 'string' ? body.confirm : '';
  } catch {
    /* sem corpo: cai na validação abaixo */
  }
  if (confirm.trim().toUpperCase() !== 'EXCLUIR') return json({ error: 'CONFIRMATION_REQUIRED' }, 400, cors);

  const sb = serviceClient();
  const db = createBillingDb(sb);

  const { data: ws } = await sb.from('workspaces').select('id').eq('owner_id', auth.user.id).maybeSingle();
  if (ws) {
    const sub = await db.getSubscription(ws.id);
    if (sub?.billing_mode === 'card' && sub.status === 'active' && sub.provider_subscription_id) {
      try {
        await createMpClient(env('MP_ACCESS_TOKEN')).cancelPreapproval(sub.provider_subscription_id);
      } catch (e) {
        console.error('delete-account: não foi possível cancelar a assinatura', String(e));
        return json({ error: 'PROVIDER_ERROR' }, 502, cors);
      }
    }
  }

  const { error } = await sb.auth.admin.deleteUser(auth.user.id);
  if (error) {
    console.error('delete-account: falha ao excluir o usuário', error.message);
    return json({ error: 'INTERNAL' }, 500, cors);
  }
  console.log('delete-account: conta excluída');
  return json({ ok: true }, 200, cors);
});
