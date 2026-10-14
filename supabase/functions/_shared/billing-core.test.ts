import { describe, expect, it } from 'vitest';
import {
  buildPreapprovalBody,
  buildPreferenceBody,
  decideCardReconcile,
  decidePixPayment,
  isSellablePlan,
  isUuid,
  parseWebhookRequest,
  toCents,
  type CheckoutRow,
  type ExistingSub,
  type MpPreapproval,
} from './billing-core.ts';

const now = new Date('2026-10-10T12:00:00Z');
const CK = '11111111-1111-4111-8111-111111111111';
const checkout: CheckoutRow = { id: CK, workspace_id: 'ws-1', plan_id: 'pro', mode: 'card' };
const price = { id: 'pro', price_cents: 1990 };
const free: ExistingSub = { plan_id: 'free', status: 'active', billing_mode: null, provider_subscription_id: null, access_until: null };
const pre = (over: Partial<MpPreapproval> = {}): MpPreapproval => ({
  id: 'pre-1',
  status: 'authorized',
  external_reference: CK,
  next_payment_date: '2026-11-10T12:00:00Z',
  auto_recurring: { transaction_amount: 19.9, currency_id: 'BRL' },
  ...over,
});
const decide = (p: MpPreapproval, existing: ExistingSub | null = free, co: CheckoutRow | null = checkout) =>
  decideCardReconcile({ preapproval: p, checkout: co, price, existing, now });

describe('helpers', () => {
  it('toCents arredonda sem erro de float', () => {
    expect(toCents(19.9)).toBe(1990);
    expect(toCents(0.29)).toBe(29);
    expect(toCents('19.90')).toBeNull();
    expect(toCents(NaN)).toBeNull();
  });
  it('isUuid', () => {
    expect(isUuid(CK)).toBe(true);
    expect(isUuid('nao-e-uuid')).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe('planos vendáveis', () => {
  it('hoje só o Pro pode ser contratado', () => {
    expect(isSellablePlan('pro')).toBe(true);
    expect(isSellablePlan('enterprise')).toBe(false);
    expect(isSellablePlan('free')).toBe(false);
    expect(isSellablePlan(undefined)).toBe(false);
  });
});

describe('decideCardReconcile', () => {
  it('assinatura autorizada concede acesso até o próximo vencimento + 3 dias', () => {
    const d = decide(pre());
    expect(d).toMatchObject({ action: 'apply', plan: 'pro', status: 'active', cancelAtPeriodEnd: false, providerSubscriptionId: 'pre-1', cancelOtherPreapproval: null });
    if (d.action === 'apply') expect(d.accessUntil?.toISOString()).toBe('2026-11-13T12:00:00.000Z');
  });

  it('limita datas absurdas a 40 dias', () => {
    const d = decide(pre({ next_payment_date: '2030-01-01T00:00:00Z' }));
    if (d.action === 'apply') expect(d.accessUntil?.toISOString()).toBe('2026-11-19T12:00:00.000Z');
    else throw new Error('esperava apply');
  });

  it('ignora o que não bate com a compra criada no servidor', () => {
    expect(decide(pre({ external_reference: 'outro' }))).toMatchObject({ reason: 'external_reference_mismatch' });
    expect(decide(pre({ auto_recurring: { transaction_amount: 1, currency_id: 'BRL' } }))).toMatchObject({ reason: 'amount_mismatch' });
    expect(decide(pre({ auto_recurring: { transaction_amount: 19.9, currency_id: 'USD' } }))).toMatchObject({ reason: 'currency_mismatch' });
    expect(decide(pre(), free, null)).toMatchObject({ reason: 'checkout_unknown' });
    expect(decide(pre(), free, { ...checkout, mode: 'pix' })).toMatchObject({ reason: 'checkout_not_card' });
    expect(decide(pre(), null)).toMatchObject({ reason: 'subscription_missing' });
  });

  it('não concede sem cobrança futura (ou com data inválida)', () => {
    expect(decide(pre({ next_payment_date: '2026-10-01T00:00:00Z' }))).toMatchObject({ reason: 'no_upcoming_charge' });
    expect(decide(pre({ next_payment_date: null }))).toMatchObject({ reason: 'no_upcoming_charge' });
    expect(decide(pre({ next_payment_date: 'lixo' }))).toMatchObject({ reason: 'no_upcoming_charge' });
  });

  it('pendente nunca concede acesso nem sobrescreve o estado atual', () => {
    expect(decide(pre({ status: 'pending' }))).toMatchObject({ action: 'ignore', reason: 'not_authorized_yet' });
    expect(decide(pre({ status: 'qualquer' }))).toMatchObject({ action: 'ignore', reason: 'status_unknown' });
  });

  it('nova assinatura autorizada substitui e manda cancelar a anterior de cartão', () => {
    const current: ExistingSub = { plan_id: 'pro', status: 'active', billing_mode: 'card', provider_subscription_id: 'pre-old', access_until: '2026-10-20T00:00:00Z' };
    expect(decide(pre({ id: 'pre-new' }), current)).toMatchObject({ action: 'apply', providerSubscriptionId: 'pre-new', cancelOtherPreapproval: 'pre-old' });
  });

  it('eventos de assinaturas antigas não alteram a atual', () => {
    const current: ExistingSub = { plan_id: 'pro', status: 'active', billing_mode: 'card', provider_subscription_id: 'pre-current', access_until: '2026-10-20T00:00:00Z' };
    expect(decide(pre({ id: 'pre-old', status: 'cancelled' }), current)).toMatchObject({ reason: 'stale_subscription' });
    expect(decide(pre({ id: 'pre-old', status: 'paused' }), current)).toMatchObject({ reason: 'stale_subscription' });
  });

  it('período pago por Pix não é alterado por cancelamento/pausa de uma assinatura de cartão antiga', () => {
    const viaPix: ExistingSub = { plan_id: 'pro', status: 'active', billing_mode: 'pix', provider_subscription_id: 'pre-1', access_until: '2026-11-12T00:00:00Z' };
    expect(decide(pre({ status: 'cancelled' }), viaPix)).toMatchObject({ action: 'ignore', reason: 'current_is_pix' });
    expect(decide(pre({ status: 'paused' }), viaPix)).toMatchObject({ action: 'ignore', reason: 'current_is_pix' });
    // mas uma NOVA assinatura de cartão autorizada continua podendo assumir
    expect(decide(pre({ id: 'pre-new' }), viaPix)).toMatchObject({ action: 'apply', status: 'active', providerSubscriptionId: 'pre-new' });
  });

  it('cancelamento da assinatura vigente mantém o período já pago', () => {
    const current: ExistingSub = { plan_id: 'pro', status: 'active', billing_mode: 'card', provider_subscription_id: 'pre-1', access_until: '2026-10-20T00:00:00Z' };
    const d = decide(pre({ status: 'cancelled' }), current);
    expect(d).toMatchObject({ action: 'apply', status: 'canceled', cancelAtPeriodEnd: true });
    if (d.action === 'apply') expect(d.accessUntil?.toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });

  it('cancelamento com período já vencido não deixa acesso', () => {
    const current: ExistingSub = { plan_id: 'pro', status: 'active', billing_mode: 'card', provider_subscription_id: 'pre-1', access_until: '2026-10-01T00:00:00Z' };
    const d = decide(pre({ status: 'cancelled' }), current);
    if (d.action === 'apply') expect(d.accessUntil).toBeNull();
    else throw new Error('esperava apply');
  });

  it('pausa vira inadimplência sem estender o acesso', () => {
    const current: ExistingSub = { plan_id: 'pro', status: 'active', billing_mode: 'card', provider_subscription_id: 'pre-1', access_until: '2026-10-12T00:00:00Z' };
    const d = decide(pre({ status: 'paused' }), current);
    expect(d).toMatchObject({ action: 'apply', status: 'past_due' });
    if (d.action === 'apply') expect(d.accessUntil?.toISOString()).toBe('2026-10-12T00:00:00.000Z');
  });
});

describe('decidePixPayment', () => {
  const pixCheckout: CheckoutRow = { id: CK, workspace_id: 'ws-1', plan_id: 'pro', mode: 'pix' };
  const payment = { id: 777, status: 'approved', external_reference: CK, transaction_amount: 19.9, currency_id: 'BRL' };

  it('pagamento aprovado concede 30 dias com chave de idempotência pelo id do pagamento', () => {
    expect(decidePixPayment({ payment, checkout: pixCheckout, price })).toEqual({ action: 'grant', workspaceId: 'ws-1', plan: 'pro', days: 30, eventKey: 'mp-payment-777' });
  });

  it('ignora pendente, recusado, valor errado, moeda errada e referência errada', () => {
    const run = (p: Partial<typeof payment>) => decidePixPayment({ payment: { ...payment, ...p }, checkout: pixCheckout, price });
    expect(run({ status: 'pending' })).toMatchObject({ reason: 'not_approved' });
    expect(run({ status: 'rejected' })).toMatchObject({ reason: 'not_approved' });
    expect(run({ status: 'refunded' })).toMatchObject({ reason: 'not_approved' });
    expect(run({ transaction_amount: 1 })).toMatchObject({ reason: 'amount_mismatch' });
    expect(run({ currency_id: 'USD' })).toMatchObject({ reason: 'currency_mismatch' });
    expect(run({ external_reference: 'x' })).toMatchObject({ reason: 'external_reference_mismatch' });
  });

  it('não concede para compra de cartão nem sem compra registrada', () => {
    expect(decidePixPayment({ payment, checkout: { ...pixCheckout, mode: 'card' }, price })).toMatchObject({ reason: 'checkout_not_pix' });
    expect(decidePixPayment({ payment, checkout: null, price })).toMatchObject({ reason: 'checkout_unknown' });
  });
});

describe('corpos de requisição', () => {
  it('assinatura: valor em reais a partir de centavos, mensal, BRL, pendente', () => {
    const b = buildPreapprovalBody({ reason: 'CaixaPro Pro', payerEmail: 'a@b.com', externalReference: CK, amountCents: 1990, backUrl: 'https://x.com/app/plano' });
    expect(b).toMatchObject({ status: 'pending', external_reference: CK, payer_email: 'a@b.com', auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 19.9, currency_id: 'BRL' } });
  });
  it('preferência: item único, referência e URLs', () => {
    const b = buildPreferenceBody({ title: 'CaixaPro Pro 30 dias', amountCents: 1990, externalReference: CK, notificationUrl: 'https://p.supabase.co/functions/v1/mp-webhook', backUrl: 'https://x.com/app/plano' });
    expect(b.items).toEqual([{ id: CK, title: 'CaixaPro Pro 30 dias', quantity: 1, unit_price: 19.9, currency_id: 'BRL' }]);
    expect(b).toMatchObject({ external_reference: CK, notification_url: 'https://p.supabase.co/functions/v1/mp-webhook', auto_return: 'approved' });
  });
});

describe('parseWebhookRequest', () => {
  const u = (q: string) => new URL(`https://p.supabase.co/functions/v1/mp-webhook?${q}`);
  it('lê topic e data.id', () => {
    expect(parseWebhookRequest(u('data.id=123&type=payment'), {})).toEqual({ topic: 'payment', rawTopic: 'payment', dataId: '123' });
    expect(parseWebhookRequest(u('data.id=abc'), { type: 'subscription_preapproval' })).toMatchObject({ topic: 'subscription_preapproval' });
    expect(parseWebhookRequest(u('data.id=9&type=subscription_authorized_payment'), null)).toMatchObject({ topic: 'subscription_authorized_payment' });
  });
  it('tópicos desconhecidos viram null e sem data.id é rejeitado', () => {
    expect(parseWebhookRequest(u('data.id=1&type=point_integration_wh'), {})?.topic).toBeNull();
    expect(parseWebhookRequest(u('topic=payment&id=1'), {})).toBeNull();
  });
});
