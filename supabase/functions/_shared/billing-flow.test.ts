import { describe, expect, it, vi } from 'vitest';
import type { CheckoutRow, ExistingSub, MpPayment, MpPreapproval } from './billing-core.ts';
import { processBillingEvent, syncWorkspace, type BillingDeps, type RecentCheckout } from './billing-flow.ts';

const CK = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-10-10T12:00:00Z');

interface World {
  checkout: CheckoutRow | null;
  existing: ExistingSub | null;
  preapprovals: Record<string, MpPreapproval>;
  payments: Record<string, MpPayment>;
  authorized: Record<string, { id: string; preapproval_id: string | null }>;
  granted: Set<string>;
  recent: RecentCheckout[];
  search: Record<string, MpPayment[]>;
}

function setup(over: Partial<World> = {}) {
  const w: World = {
    checkout: { id: CK, workspace_id: 'ws-1', plan_id: 'pro', mode: 'card' },
    existing: { plan_id: 'free', status: 'active', billing_mode: null, provider_subscription_id: null, access_until: null },
    preapprovals: {},
    payments: {},
    authorized: {},
    granted: new Set(),
    recent: [],
    search: {},
    ...over,
  };
  const applySubscription = vi.fn(async (_p: unknown) => undefined);
  const grantPeriod = vi.fn(async (p: { eventKey: string }) => {
    if (w.granted.has(p.eventKey)) return false;
    w.granted.add(p.eventKey);
    return true;
  });
  const cancelPreapproval = vi.fn(async (_id: string) => undefined);
  const deps: BillingDeps = {
    now: () => now,
    mp: {
      getPreapproval: async (id) => w.preapprovals[id] ?? Promise.reject(new Error('404')),
      getPayment: async (id) => w.payments[id] ?? Promise.reject(new Error('404')),
      getAuthorizedPayment: async (id) => w.authorized[id] ?? Promise.reject(new Error('404')),
      cancelPreapproval,
      searchPaymentsByReference: async (ref) => w.search[ref] ?? [],
    },
    db: {
      getCheckout: async (id) => (w.checkout && w.checkout.id === id ? w.checkout : null),
      getPlanPrice: async (plan) => (plan === 'pro' ? { id: 'pro', price_cents: 1990 } : plan === 'enterprise' ? { id: 'enterprise', price_cents: 7990 } : null),
      getSubscription: async () => w.existing,
      applySubscription,
      grantPeriod,
      listRecentCheckouts: async () => w.recent,
    },
  };
  return { deps, w, applySubscription, grantPeriod, cancelPreapproval };
}

const authorizedPre = (id = 'pre-1'): MpPreapproval => ({
  id,
  status: 'authorized',
  external_reference: CK,
  next_payment_date: '2026-11-10T12:00:00Z',
  auto_recurring: { transaction_amount: 19.9, currency_id: 'BRL' },
});

describe('assinatura por cartão', () => {
  it('aplica o estado a partir da API do provedor (não do corpo do webhook)', async () => {
    const t = setup({ preapprovals: { 'pre-1': authorizedPre() } });
    expect(await processBillingEvent(t.deps, 'subscription_preapproval', 'pre-1')).toBe('applied:active');
    expect(t.applySubscription).toHaveBeenCalledOnce();
    expect(t.applySubscription).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws-1', plan: 'pro', status: 'active', mode: 'card', providerSubscriptionId: 'pre-1' }));
  });

  it('reprocessar o mesmo evento é seguro (mesmo resultado)', async () => {
    const t = setup({ preapprovals: { 'pre-1': authorizedPre() } });
    await processBillingEvent(t.deps, 'subscription_preapproval', 'pre-1');
    await processBillingEvent(t.deps, 'subscription_preapproval', 'pre-1');
    const [a, b] = t.applySubscription.mock.calls.map((c) => c[0]);
    expect(a).toEqual(b);
  });

  it('evento de cobrança autorizada busca a assinatura-mãe', async () => {
    const t = setup({ preapprovals: { 'pre-1': authorizedPre() }, authorized: { 'ap-9': { id: 'ap-9', preapproval_id: 'pre-1' } } });
    expect(await processBillingEvent(t.deps, 'subscription_authorized_payment', 'ap-9')).toBe('applied:active');
  });

  it('cobrança autorizada sem assinatura-mãe é ignorada', async () => {
    const t = setup({ authorized: { 'ap-9': { id: 'ap-9', preapproval_id: null } } });
    expect(await processBillingEvent(t.deps, 'subscription_authorized_payment', 'ap-9')).toBe('ignored:no_preapproval');
    expect(t.applySubscription).not.toHaveBeenCalled();
  });

  it('assinatura nova cancela a anterior no provedor', async () => {
    const t = setup({
      preapprovals: { 'pre-new': authorizedPre('pre-new') },
      existing: { plan_id: 'pro', status: 'active', billing_mode: 'card', provider_subscription_id: 'pre-old', access_until: '2026-10-20T00:00:00Z' },
    });
    await processBillingEvent(t.deps, 'subscription_preapproval', 'pre-new');
    expect(t.cancelPreapproval).toHaveBeenCalledWith('pre-old');
  });

  it('falha ao cancelar a anterior não derruba o processamento', async () => {
    const t = setup({
      preapprovals: { 'pre-new': authorizedPre('pre-new') },
      existing: { plan_id: 'pro', status: 'active', billing_mode: 'card', provider_subscription_id: 'pre-old', access_until: '2026-10-20T00:00:00Z' },
    });
    t.cancelPreapproval.mockRejectedValueOnce(new Error('boom'));
    expect(await processBillingEvent(t.deps, 'subscription_preapproval', 'pre-new')).toBe('applied:active');
  });

  it('referência que não é UUID ou sem compra registrada é ignorada sem consultar o banco', async () => {
    const t = setup({ preapprovals: { x: { ...authorizedPre('x'), external_reference: 'qualquer-coisa' } } });
    expect(await processBillingEvent(t.deps, 'subscription_preapproval', 'x')).toBe('ignored:checkout_unknown');
    expect(t.applySubscription).not.toHaveBeenCalled();
  });

  it('erro do provedor propaga (para o webhook responder 500 e o provedor reenviar)', async () => {
    const t = setup();
    await expect(processBillingEvent(t.deps, 'subscription_preapproval', 'inexistente')).rejects.toThrow('404');
  });
});

describe('pagamento avulso (Pix)', () => {
  const pix: CheckoutRow = { id: CK, workspace_id: 'ws-1', plan_id: 'pro', mode: 'pix' };
  const approved = (id = 555): MpPayment => ({ id, status: 'approved', external_reference: CK, transaction_amount: 19.9, currency_id: 'BRL' });

  it('pagamento aprovado concede 30 dias uma única vez, mesmo com notificações repetidas', async () => {
    const t = setup({ checkout: pix, payments: { '555': approved() } });
    expect(await processBillingEvent(t.deps, 'payment', '555')).toBe('granted');
    expect(await processBillingEvent(t.deps, 'payment', '555')).toBe('ignored:already_applied');
    expect(await processBillingEvent(t.deps, 'payment', '555')).toBe('ignored:already_applied');
    expect(t.grantPeriod).toHaveBeenCalledWith({ workspaceId: 'ws-1', plan: 'pro', days: 30, eventKey: 'mp-payment-555', mode: 'pix', stack: true });
  });

  it('pagamentos pendentes ou de valor errado não concedem nada', async () => {
    const t = setup({ checkout: pix, payments: { '1': { ...approved(1), status: 'pending' }, '2': { ...approved(2), transaction_amount: 0.01 } } });
    expect(await processBillingEvent(t.deps, 'payment', '1')).toBe('ignored:not_approved');
    expect(await processBillingEvent(t.deps, 'payment', '2')).toBe('ignored:amount_mismatch');
    expect(t.grantPeriod).not.toHaveBeenCalled();
  });

  it('pagamento sem relação com uma compra nossa é ignorado', async () => {
    const t = setup({ checkout: pix, payments: { '3': { ...approved(3), external_reference: 'de-outro-sistema' } } });
    expect(await processBillingEvent(t.deps, 'payment', '3')).toBe('ignored:not_ours');
    expect(t.grantPeriod).not.toHaveBeenCalled();
  });

  it('cobranças da assinatura de cartão são tratadas só pelo fluxo de assinatura', async () => {
    const t = setup({ checkout: { ...pix, mode: 'card' }, payments: { '4': approved(4) } });
    expect(await processBillingEvent(t.deps, 'payment', '4')).toBe('ignored:card_handled_by_subscription');
    expect(t.grantPeriod).not.toHaveBeenCalled();
  });

  it('quem passa a pagar com Pix tem a assinatura de cartão cancelada', async () => {
    const t = setup({
      checkout: pix,
      payments: { '555': approved() },
      existing: { plan_id: 'pro', status: 'active', billing_mode: 'card', provider_subscription_id: 'pre-card', access_until: '2026-10-20T00:00:00Z' },
    });
    await processBillingEvent(t.deps, 'payment', '555');
    expect(t.cancelPreapproval).toHaveBeenCalledWith('pre-card');
  });
});

describe('sincronização ativa (sem webhook)', () => {
  const pixCk: RecentCheckout = { id: CK, workspace_id: 'ws-1', plan_id: 'pro', mode: 'pix', provider_ref: 'pref-1' };
  const cardCk = (id: string, ref: string | null): RecentCheckout => ({ id, workspace_id: 'ws-1', plan_id: 'pro', mode: 'card', provider_ref: ref });
  const paid: MpPayment = { id: 901, status: 'approved', external_reference: CK, transaction_amount: 19.9, currency_id: 'BRL' };

  it('Pix pago é encontrado pela referência e concede o plano', async () => {
    const t = setup({ checkout: { ...pixCk }, recent: [pixCk], search: { [CK]: [paid] } });
    const r = await syncWorkspace(t.deps, 'ws-1');
    expect(r).toEqual([{ checkoutId: CK, mode: 'pix', outcomes: ['granted'] }]);
    expect(t.grantPeriod).toHaveBeenCalledOnce();
  });

  it('chamar de novo não concede duas vezes', async () => {
    const t = setup({ checkout: { ...pixCk }, recent: [pixCk], search: { [CK]: [paid] } });
    await syncWorkspace(t.deps, 'ws-1');
    const again = await syncWorkspace(t.deps, 'ws-1');
    expect(again[0]?.outcomes).toEqual(['ignored:already_applied']);
  });

  it('sem pagamento encontrado, informa o motivo', async () => {
    const t = setup({ checkout: { ...pixCk }, recent: [pixCk] });
    expect((await syncWorkspace(t.deps, 'ws-1'))[0]?.outcomes).toEqual(['sem_pagamento_encontrado']);
    expect(t.grantPeriod).not.toHaveBeenCalled();
  });

  it('pagamento pendente não concede', async () => {
    const t = setup({ checkout: { ...pixCk }, recent: [pixCk], search: { [CK]: [{ ...paid, status: 'pending' }] } });
    expect((await syncWorkspace(t.deps, 'ws-1'))[0]?.outcomes).toEqual(['ignored:not_approved']);
  });

  it('assinatura de cartão autorizada é aplicada a partir da assinatura criada', async () => {
    const t = setup({ recent: [cardCk(CK, 'pre-1')], preapprovals: { 'pre-1': authorizedPre() } });
    expect((await syncWorkspace(t.deps, 'ws-1'))[0]?.outcomes).toEqual(['applied:active']);
    expect(t.applySubscription).toHaveBeenCalledOnce();
  });

  it('compra de cartão sem assinatura criada é sinalizada', async () => {
    const t = setup({ recent: [cardCk(CK, null)] });
    expect((await syncWorkspace(t.deps, 'ws-1'))[0]?.outcomes).toEqual(['sem_assinatura_criada']);
  });

  it('só a compra de cartão mais recente é reconciliada (a antiga não substitui a atual)', async () => {
    const OLD = '33333333-3333-4333-8333-333333333333';
    const t = setup({ recent: [cardCk(CK, 'pre-new'), cardCk(OLD, 'pre-old')], preapprovals: { 'pre-new': { ...authorizedPre('pre-new') } } });
    const r = await syncWorkspace(t.deps, 'ws-1');
    expect(r[0]?.outcomes).toEqual(['applied:active']);
    expect(r[1]?.outcomes).toEqual(['ignored:compra_de_cartao_mais_antiga']);
    expect(t.applySubscription).toHaveBeenCalledOnce();
  });

  it('erro do provedor vira resultado, não exceção (as outras compras continuam)', async () => {
    const t = setup({ checkout: { ...pixCk }, recent: [cardCk('44444444-4444-4444-8444-444444444444', 'pre-x'), pixCk], search: { [CK]: [paid] } });
    const r = await syncWorkspace(t.deps, 'ws-1');
    expect(r[0]?.outcomes[0]).toMatch(/^erro:/);
    expect(r[1]?.outcomes).toEqual(['granted']);
  });

  it('sem compras recentes, nada acontece', async () => {
    const t = setup();
    expect(await syncWorkspace(t.deps, 'ws-1')).toEqual([]);
  });
});
