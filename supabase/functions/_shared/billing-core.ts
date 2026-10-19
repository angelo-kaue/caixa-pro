/** Regras de cobrança: puras e testáveis. Nada aqui acessa rede nem banco. */

export type PaidPlan = 'pro' | 'enterprise';
export type BillingMode = 'card' | 'pix';

export const PIX_DAYS = 30;
/** Folga depois do próximo vencimento da assinatura, para atrasos do webhook/cobrança. */
export const CARD_BUFFER_DAYS = 3;
/** Teto para evitar datas absurdas vindas do provedor. */
export const MAX_AHEAD_DAYS = 40;
const DAY_MS = 86_400_000;

/** Planos que podem ser contratados hoje. O Enterprise só será vendido quando seus recursos existirem (Fase 5). */
export const SELLABLE_PLANS: readonly PaidPlan[] = ['pro'];
export const isSellablePlan = (v: unknown): v is PaidPlan => SELLABLE_PLANS.includes(v as PaidPlan);
export const isPaidPlan = (v: unknown): v is PaidPlan => v === 'pro' || v === 'enterprise';
export const isBillingMode = (v: unknown): v is BillingMode => v === 'card' || v === 'pix';
export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** E-mail do pagador no Mercado Pago (o da conta de quem vai pagar). Vazio usa o padrão; inválido devolve null. */
export function normalizePayerEmail(value: unknown, fallback: string): string | null {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : null;
}

export const toCents = (amount: unknown): number | null =>
  typeof amount === 'number' && Number.isFinite(amount) ? Math.round(amount * 100) : null;

export const centsToAmount = (cents: number): number => Number((cents / 100).toFixed(2));

/* ----------------------------- tipos do provedor ----------------------------- */

export interface MpPreapproval {
  id: string;
  status?: string;
  external_reference?: string | null;
  next_payment_date?: string | null;
  auto_recurring?: { transaction_amount?: number; currency_id?: string } | null;
}

export interface MpPayment {
  id: number | string;
  status?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
}

export interface MpAuthorizedPayment {
  id: number | string;
  preapproval_id?: string | null;
}

export interface CheckoutRow {
  id: string;
  workspace_id: string;
  plan_id: string;
  mode: BillingMode;
}

export interface PlanPrice {
  id: string;
  price_cents: number;
}

export interface ExistingSub {
  plan_id: string;
  status: string;
  billing_mode: string | null;
  provider_subscription_id: string | null;
  access_until: string | null;
}

/* ----------------------------- assinatura (cartão) ----------------------------- */

export type CardDecision =
  | { action: 'ignore'; reason: string }
  | {
      action: 'apply';
      workspaceId: string;
      plan: PaidPlan;
      status: 'active' | 'past_due' | 'canceled';
      accessUntil: Date | null;
      cancelAtPeriodEnd: boolean;
      providerSubscriptionId: string;
      /** Assinatura anterior (cartão) a cancelar no provedor, quando uma nova a substitui. */
      cancelOtherPreapproval: string | null;
    };

const ignore = (reason: string): CardDecision => ({ action: 'ignore', reason });

export function decideCardReconcile(input: {
  preapproval: MpPreapproval;
  checkout: CheckoutRow | null;
  price: PlanPrice | null;
  existing: ExistingSub | null;
  now: Date;
}): CardDecision {
  const { preapproval: pre, checkout, price, existing, now } = input;

  if (!checkout) return ignore('checkout_unknown');
  if (checkout.mode !== 'card') return ignore('checkout_not_card');
  if (!isPaidPlan(checkout.plan_id) || !price || price.id !== checkout.plan_id) return ignore('plan_unknown');
  if (pre.external_reference !== checkout.id) return ignore('external_reference_mismatch');
  if (pre.auto_recurring?.currency_id !== 'BRL') return ignore('currency_mismatch');
  if (toCents(pre.auto_recurring?.transaction_amount) !== price.price_cents) return ignore('amount_mismatch');
  if (!existing) return ignore('subscription_missing');

  // Se o período vigente foi pago por Pix, cancelamentos/pausas de assinaturas de cartão antigas não mexem no estado.
  if (existing.billing_mode === 'pix' && pre.status !== 'authorized') return ignore('current_is_pix');

  const isCurrent = existing.provider_subscription_id === pre.id;
  const plan = checkout.plan_id;
  const accessEnd = existing.access_until ? new Date(existing.access_until) : null;
  const remaining = accessEnd && accessEnd.getTime() > now.getTime() ? accessEnd : null;

  switch (pre.status) {
    case 'authorized': {
      const next = pre.next_payment_date ? new Date(pre.next_payment_date) : null;
      if (!next || Number.isNaN(next.getTime()) || next.getTime() <= now.getTime()) return ignore('no_upcoming_charge');
      const until = Math.min(next.getTime() + CARD_BUFFER_DAYS * DAY_MS, now.getTime() + MAX_AHEAD_DAYS * DAY_MS);
      const replacing = !isCurrent && existing.billing_mode === 'card' && existing.provider_subscription_id;
      return {
        action: 'apply',
        workspaceId: checkout.workspace_id,
        plan,
        status: 'active',
        accessUntil: new Date(until),
        cancelAtPeriodEnd: false,
        providerSubscriptionId: pre.id,
        cancelOtherPreapproval: replacing ? existing.provider_subscription_id : null,
      };
    }
    case 'cancelled':
      // Só a assinatura vigente pode cancelar o plano; eventos de assinaturas antigas são ignorados.
      if (!isCurrent) return ignore('stale_subscription');
      return {
        action: 'apply',
        workspaceId: checkout.workspace_id,
        plan,
        status: 'canceled',
        accessUntil: remaining,
        cancelAtPeriodEnd: true,
        providerSubscriptionId: pre.id,
        cancelOtherPreapproval: null,
      };
    case 'paused':
      if (!isCurrent) return ignore('stale_subscription');
      return {
        action: 'apply',
        workspaceId: checkout.workspace_id,
        plan,
        status: 'past_due',
        accessUntil: remaining,
        cancelAtPeriodEnd: false,
        providerSubscriptionId: pre.id,
        cancelOtherPreapproval: null,
      };
    case 'pending':
      return ignore('not_authorized_yet');
    default:
      return ignore('status_unknown');
  }
}

/* ----------------------------- pagamento avulso (Pix) ----------------------------- */

export type PixDecision =
  | { action: 'ignore'; reason: string }
  | { action: 'grant'; workspaceId: string; plan: PaidPlan; days: number; eventKey: string };

export function decidePixPayment(input: { payment: MpPayment; checkout: CheckoutRow | null; price: PlanPrice | null }): PixDecision {
  const { payment, checkout, price } = input;
  if (!checkout) return { action: 'ignore', reason: 'checkout_unknown' };
  if (checkout.mode !== 'pix') return { action: 'ignore', reason: 'checkout_not_pix' };
  if (!isPaidPlan(checkout.plan_id) || !price || price.id !== checkout.plan_id) return { action: 'ignore', reason: 'plan_unknown' };
  if (payment.external_reference !== checkout.id) return { action: 'ignore', reason: 'external_reference_mismatch' };
  if (payment.status !== 'approved') return { action: 'ignore', reason: 'not_approved' };
  if (payment.currency_id !== 'BRL') return { action: 'ignore', reason: 'currency_mismatch' };
  if (toCents(payment.transaction_amount) !== price.price_cents) return { action: 'ignore', reason: 'amount_mismatch' };
  return { action: 'grant', workspaceId: checkout.workspace_id, plan: checkout.plan_id, days: PIX_DAYS, eventKey: `mp-payment-${payment.id}` };
}

/* ----------------------------- corpos de requisição ----------------------------- */

export function buildPreapprovalBody(input: { reason: string; payerEmail: string; externalReference: string; amountCents: number; backUrl: string }) {
  return {
    reason: input.reason,
    external_reference: input.externalReference,
    payer_email: input.payerEmail,
    back_url: input.backUrl,
    status: 'pending',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: centsToAmount(input.amountCents),
      currency_id: 'BRL',
    },
  };
}

export function buildPreferenceBody(input: { title: string; amountCents: number; externalReference: string; notificationUrl: string; backUrl: string }) {
  return {
    items: [{ id: input.externalReference, title: input.title, quantity: 1, unit_price: centsToAmount(input.amountCents), currency_id: 'BRL' }],
    external_reference: input.externalReference,
    notification_url: input.notificationUrl,
    back_urls: { success: input.backUrl, pending: input.backUrl, failure: input.backUrl },
    auto_return: 'approved',
    statement_descriptor: 'CAIXAPRO',
  };
}

/* ----------------------------- entrada do webhook ----------------------------- */

export type WebhookTopic = 'payment' | 'subscription_preapproval' | 'subscription_authorized_payment';

export interface ParsedWebhook {
  topic: WebhookTopic | null;
  rawTopic: string;
  /** data.id da query string: é o valor usado na assinatura. */
  dataId: string;
}

export function parseWebhookRequest(url: URL, body: unknown): ParsedWebhook | null {
  const dataId = url.searchParams.get('data.id');
  if (!dataId) return null;
  const b = (body ?? {}) as { type?: unknown; topic?: unknown };
  const raw = String(b.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic') ?? '');
  const topic: WebhookTopic | null =
    raw === 'payment' ? 'payment' : raw === 'subscription_preapproval' || raw === 'preapproval' ? 'subscription_preapproval' : raw === 'subscription_authorized_payment' ? 'subscription_authorized_payment' : null;
  return { topic, rawTopic: raw, dataId };
}
