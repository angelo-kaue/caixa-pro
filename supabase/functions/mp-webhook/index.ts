// Webhook do Mercado Pago. Deploy SEM verificação de JWT (o Mercado Pago não envia JWT):
//   supabase functions deploy mp-webhook --no-verify-jwt
// A autenticidade vem da assinatura HMAC (x-signature) validada com MP_WEBHOOK_SECRET.
import { parseWebhookRequest } from '../_shared/billing-core.ts';
import { processBillingEvent } from '../_shared/billing-flow.ts';
import { MpError, createMpClient } from '../_shared/mp-client.ts';
import { verifyMpSignature } from '../_shared/mp-signature.ts';
import { createBillingDb, env, serviceClient } from '../_deno/runtime.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    /* algumas notificações vêm sem corpo; os dados estão na query string */
  }

  const parsed = parseWebhookRequest(new URL(req.url), body);
  if (!parsed) {
    const url = new URL(req.url);
    console.warn('webhook recusado: sem data.id', JSON.stringify({ params: [...url.searchParams.keys()], assinatura: req.headers.has('x-signature') }));
    return new Response('Bad request', { status: 400 });
  }

  const requestId = req.headers.get('x-request-id');
  const valid = await verifyMpSignature({
    secret: Deno.env.get('MP_WEBHOOK_SECRET'),
    signatureHeader: req.headers.get('x-signature'),
    requestId,
    dataId: parsed.dataId,
  });
  if (!valid) {
    console.warn('webhook recusado: assinatura inválida', JSON.stringify({ tipo: parsed.rawTopic, assinatura: req.headers.has('x-signature'), requestId: Boolean(requestId) }));
    return new Response('Invalid signature', { status: 401 });
  }
  console.log('webhook recebido', JSON.stringify({ tipo: parsed.rawTopic, id: parsed.dataId }));

  const sb = serviceClient();
  const eventKey = `${requestId ?? 'noreq'}:${parsed.rawTopic}:${parsed.dataId}`;
  const record = (outcome: string) =>
    sb.rpc('record_payment_event', { p_provider: 'mercadopago', p_event_key: eventKey, p_topic: parsed.rawTopic, p_resource_id: parsed.dataId, p_outcome: outcome });

  if (!parsed.topic) {
    await record('ignored:topic');
    return new Response('ok');
  }

  try {
    const outcome = await processBillingEvent(
      {
        mp: createMpClient(env('MP_ACCESS_TOKEN')),
        db: createBillingDb(sb),
        now: () => new Date(),
        log: (message, extra) => console.warn(message, JSON.stringify(extra ?? {})),
      },
      parsed.topic,
      parsed.dataId,
    );
    await record(outcome);
    console.log('webhook processado', JSON.stringify({ tipo: parsed.rawTopic, resultado: outcome }));
    return new Response('ok');
  } catch (e) {
    // 500 faz o Mercado Pago reenviar a notificação depois.
    console.error('Falha ao processar webhook', parsed.rawTopic, parsed.dataId, String(e), e instanceof MpError ? (e.detail ?? '') : '');
    return new Response('error', { status: 500 });
  }
});
