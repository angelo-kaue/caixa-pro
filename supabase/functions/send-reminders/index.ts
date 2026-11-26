// Envia os lembretes de "registre seus gastos" por Web Push.
// Dois modos:
//  1) Agendador (pg_cron): cabeçalho x-cron-secret + {"slot":"noon"|"evening"|"night"}. Envia a quem ainda não lançou nada hoje.
//  2) Teste do próprio usuário (JWT logado): {"test":true}. Envia só para os aparelhos dele.
// Publique com: npx supabase functions deploy send-reminders --no-verify-jwt (o agendador não envia JWT; o modo 2 valida o JWT aqui).
import { corsHeaders, env, json, serviceClient, userClient } from '../_deno/runtime.ts';
import { constantTimeEqual, isAllowedPushEndpoint, isSlot, pickMessage, startOfDayBRT, type ReminderMessage } from '../_shared/reminders.ts';
import { sendWebPush, type VapidKeys } from '../_shared/webpush.ts';

interface Target {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

const CONCURRENCY = 10;

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, cors);

  let body: { slot?: unknown; test?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* sem corpo: cai nas validações abaixo */
  }

  const sb = serviceClient();
  let targets: Target[];
  let message: ReminderMessage;

  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== null) {
    if (!constantTimeEqual(cronSecret, env('REMINDER_CRON_SECRET'))) return json({ error: 'UNAUTHENTICATED' }, 401, cors);
    if (!isSlot(body.slot)) return json({ error: 'INVALID_SLOT' }, 400, cors);
    const now = new Date();
    const { data, error } = await sb.rpc('reminder_targets', { p_since: startOfDayBRT(now).toISOString() });
    if (error) {
      console.error('send-reminders: falha ao listar destinatários', error.message);
      return json({ error: 'INTERNAL' }, 500, cors);
    }
    targets = (data ?? []) as Target[];
    message = pickMessage(body.slot, now);
  } else {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'UNAUTHENTICATED' }, 401, cors);
    const { data: auth, error: authError } = await userClient(authorization).auth.getUser();
    if (authError || !auth.user) return json({ error: 'UNAUTHENTICATED' }, 401, cors);
    if (body.test !== true) return json({ error: 'INVALID_REQUEST' }, 400, cors);
    const { data, error } = await sb.from('push_subscriptions').select('id, endpoint, p256dh, auth_key').eq('user_id', auth.user.id);
    if (error) {
      console.error('send-reminders: falha ao ler aparelhos', error.message);
      return json({ error: 'INTERNAL' }, 500, cors);
    }
    targets = (data ?? []) as Target[];
    message = { title: 'CaixaPro', body: 'Tudo certo! Os lembretes estão funcionando neste aparelho.' };
  }

  const vapid: VapidKeys = { publicKey: env('VAPID_PUBLIC_KEY'), privateKey: env('VAPID_PRIVATE_KEY'), subject: env('VAPID_SUBJECT') };
  const payload = { ...message, url: '/app', tag: 'caixapro-lembrete' };
  const ok: string[] = [];
  const gone: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    await Promise.all(
      targets.slice(i, i + CONCURRENCY).map(async (t) => {
        if (!isAllowedPushEndpoint(t.endpoint)) {
          gone.push(t.id);
          return;
        }
        try {
          const res = await sendWebPush(t, payload, vapid);
          if (res.status >= 200 && res.status < 300) ok.push(t.id);
          else if (res.gone) gone.push(t.id);
          else {
            console.error('send-reminders: serviço de push respondeu', res.status);
            failed.push(t.id);
          }
        } catch (e) {
          console.error('send-reminders: erro no envio', String(e));
          failed.push(t.id);
        }
      }),
    );
  }

  const { error: recordError } = await sb.rpc('record_push_results', { p_ok: ok, p_gone: gone, p_failed: failed });
  if (recordError) console.error('send-reminders: falha ao registrar resultados', recordError.message);

  console.log(`send-reminders: ${ok.length} enviados, ${gone.length} removidos, ${failed.length} falhas`);
  return json({ sent: ok.length, removed: gone.length, failed: failed.length }, 200, cors);
});
