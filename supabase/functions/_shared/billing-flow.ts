import {
  decideCardReconcile,
  decidePixPayment,
  isUuid,
  type CheckoutRow,
  type ExistingSub,
  type MpAuthorizedPayment,
  type MpPayment,
  type MpPreapproval,
  type PaidPlan,
  type PlanPrice,
  type WebhookTopic,
} from './billing-core.ts';

export interface MpApi {
  getPreapproval(id: string): Promise<MpPreapproval>;
  getAuthorizedPayment(id: string): Promise<MpAuthorizedPayment>;
  getPayment(id: string): Promise<MpPayment>;
  cancelPreapproval(id: string): Promise<void>;
  searchPaymentsByReference(reference: string): Promise<MpPayment[]>;
}

export interface RecentCheckout extends CheckoutRow {
  provider_ref: string | null;
}

export interface BillingDb {
  getCheckout(id: string): Promise<CheckoutRow | null>;
  /** Compras criadas recentemente para o espaço de trabalho (mais novas primeiro). */
  listRecentCheckouts(workspaceId: string): Promise<RecentCheckout[]>;
  getPlanPrice(plan: string): Promise<PlanPrice | null>;
  getSubscription(workspaceId: string): Promise<ExistingSub | null>;
  applySubscription(p: {
    workspaceId: string;
    plan: PaidPlan;
    status: 'active' | 'past_due' | 'canceled';
    accessUntil: Date | null;
    cancelAtPeriodEnd: boolean;
    providerSubscriptionId: string;
    mode: 'card';
  }): Promise<void>;
  grantPeriod(p: { workspaceId: string; plan: PaidPlan; days: number; eventKey: string; mode: 'pix'; stack: boolean }): Promise<boolean>;
}

export interface BillingDeps {
  mp: MpApi;
  db: BillingDb;
  now: () => Date;
  log?: (message: string, extra?: Record<string, unknown>) => void;
}

/** Sempre reconsulta o provedor (fonte da verdade) e aplica o estado resultante. Idempotente. */
async function reconcileCard(deps: BillingDeps, pre: MpPreapproval): Promise<string> {
  const ref = pre.external_reference;
  const checkout = isUuid(ref) ? await deps.db.getCheckout(ref) : null;
  const price = checkout ? await deps.db.getPlanPrice(checkout.plan_id) : null;
  const existing = checkout ? await deps.db.getSubscription(checkout.workspace_id) : null;

  const d = decideCardReconcile({ preapproval: pre, checkout, price, existing, now: deps.now() });
  if (d.action === 'ignore') return `ignored:${d.reason}`;

  await deps.db.applySubscription({
    workspaceId: d.workspaceId,
    plan: d.plan,
    status: d.status,
    accessUntil: d.accessUntil,
    cancelAtPeriodEnd: d.cancelAtPeriodEnd,
    providerSubscriptionId: d.providerSubscriptionId,
    mode: 'card',
  });

  if (d.cancelOtherPreapproval) {
    try {
      await deps.mp.cancelPreapproval(d.cancelOtherPreapproval);
    } catch (e) {
      deps.log?.('falha ao cancelar assinatura anterior', { id: d.cancelOtherPreapproval, error: String(e) });
    }
  }
  return `applied:${d.status}`;
}

/** "status/status_detail" do pagamento, para o diagnóstico (ex.: rejected/cc_rejected_high_risk). */
const statusOf = (p: MpPayment): string => `${p.status ?? '?'}${p.status_detail ? `/${p.status_detail}` : ''}`;

async function reconcilePix(deps: BillingDeps, payment: MpPayment): Promise<string> {
  const ref = payment.external_reference;
  const checkout = isUuid(ref) ? await deps.db.getCheckout(ref) : null;
  if (!checkout) return 'ignored:not_ours';
  if (checkout.mode === 'card') return `ignored:card_handled_by_subscription:${statusOf(payment)}`;

  const price = await deps.db.getPlanPrice(checkout.plan_id);
  const d = decidePixPayment({ payment, checkout, price });
  if (d.action === 'ignore') return d.reason === 'not_approved' ? `ignored:not_approved:${statusOf(payment)}` : `ignored:${d.reason}`;

  const before = await deps.db.getSubscription(d.workspaceId);
  const applied = await deps.db.grantPeriod({ workspaceId: d.workspaceId, plan: d.plan, days: d.days, eventKey: d.eventKey, mode: 'pix', stack: true });
  if (!applied) return 'ignored:already_applied';

  // Quem passa a pagar por Pix não pode continuar sendo cobrado no cartão.
  if (before?.billing_mode === 'card' && before.provider_subscription_id) {
    try {
      await deps.mp.cancelPreapproval(before.provider_subscription_id);
    } catch (e) {
      deps.log?.('falha ao cancelar assinatura de cartão após Pix', { id: before.provider_subscription_id, error: String(e) });
    }
  }
  return 'granted';
}

export async function processBillingEvent(deps: BillingDeps, topic: WebhookTopic, resourceId: string): Promise<string> {
  switch (topic) {
    case 'subscription_preapproval':
      return reconcileCard(deps, await deps.mp.getPreapproval(resourceId));
    case 'subscription_authorized_payment': {
      const ap = await deps.mp.getAuthorizedPayment(resourceId);
      if (!ap.preapproval_id) return 'ignored:no_preapproval';
      return reconcileCard(deps, await deps.mp.getPreapproval(ap.preapproval_id));
    }
    case 'payment':
      return reconcilePix(deps, await deps.mp.getPayment(resourceId));
  }
}

export interface SyncResult {
  checkoutId: string;
  mode: 'card' | 'pix';
  outcomes: string[];
}

/**
 * Confirma ativamente, junto ao provedor, as compras recentes de um espaço de trabalho.
 * Não depende do webhook: é chamada quando o cliente volta do pagamento. Idempotente.
 */
export async function syncWorkspace(deps: BillingDeps, workspaceId: string, opts: { paymentId?: string } = {}): Promise<SyncResult[]> {
  const checkouts = await deps.db.listRecentCheckouts(workspaceId);
  const results: SyncResult[] = [];

  // Caminho direto: o Mercado Pago devolve o número do pagamento na URL de retorno.
  if (opts.paymentId) {
    const outcomes: string[] = [];
    try {
      const payment = await deps.mp.getPayment(opts.paymentId);
      // Só vale se o pagamento pertencer a uma compra recente DESTE espaço de trabalho.
      const mine = checkouts.find((c) => c.id === payment.external_reference);
      outcomes.push(mine ? await reconcilePix(deps, payment) : 'ignored:pagamento_nao_pertence_a_este_espaco');
    } catch (e) {
      outcomes.push(`erro:${String(e).slice(0, 160)}`);
    }
    results.push({ checkoutId: `payment-${opts.paymentId}`, mode: 'pix', outcomes });
  }

  // Só a compra de cartão mais recente é reconciliada: uma antiga ainda "autorizada" não pode substituir a atual.
  let cardHandled = false;

  for (const c of checkouts) {
    const outcomes: string[] = [];
    try {
      if (c.mode === 'pix') {
        const payments = await deps.mp.searchPaymentsByReference(c.id);
        if (payments.length === 0) outcomes.push('sem_pagamento_encontrado');
        for (const p of payments) outcomes.push(await reconcilePix(deps, p));
      } else if (cardHandled) {
        outcomes.push('ignored:compra_de_cartao_mais_antiga');
      } else if (!c.provider_ref) {
        cardHandled = true;
        outcomes.push('sem_assinatura_criada');
      } else {
        cardHandled = true;
        outcomes.push(await reconcileCard(deps, await deps.mp.getPreapproval(c.provider_ref)));
      }
    } catch (e) {
      outcomes.push(`erro:${String(e).slice(0, 160)}`);
    }
    results.push({ checkoutId: c.id, mode: c.mode, outcomes });
  }
  return results;
}
