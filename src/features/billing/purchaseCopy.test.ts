import { describe, expect, it } from 'vitest';
import { describePurchase, type PurchaseContext } from './purchaseCopy';

const free: PurchaseContext = { plan: 'free', status: 'active', billingMode: null, accessUntil: null };
const pix: PurchaseContext = { plan: 'pro', status: 'active', billingMode: 'pix', accessUntil: '2026-11-14T12:00:00Z' };
const card: PurchaseContext = { plan: 'pro', status: 'active', billingMode: 'card', accessUntil: '2026-11-14T12:00:00Z' };
const canceled: PurchaseContext = { plan: 'pro', status: 'canceled', billingMode: 'card', accessUntil: '2026-11-14T12:00:00Z' };
const manual: PurchaseContext = { plan: 'pro', status: 'active', billingMode: null, accessUntil: null };

describe('describePurchase', () => {
  it('no Free, segue direto, sem confirmação', () => {
    expect(describePurchase('card', free)).toEqual({ label: 'Assinar no cartão (mensal)', confirm: null, disabled: false });
    expect(describePurchase('pix', free)).toEqual({ label: 'Pagar 30 dias com Pix', confirm: null, disabled: false });
  });

  it('com Pix ativo: renovar soma 30 dias e mostra a nova data', () => {
    const p = describePurchase('pix', pix);
    expect(p.label).toBe('Renovar com Pix (+30 dias)');
    expect(p.disabled).toBe(false);
    expect(p.confirm).toContain('14/11/2026');
    expect(p.confirm).toContain('14/12/2026');
  });

  it('com Pix ativo: passar para o cartão avisa que começa hoje e que os dias do Pix não somam', () => {
    const p = describePurchase('card', pix);
    expect(p.label).toBe('Passar para o cartão (mensal)');
    expect(p.confirm).toContain('pago por Pix');
    expect(p.confirm).toContain('não são somados');
  });

  it('com cartão ativo: o botão do cartão fica desabilitado e o Pix avisa do cancelamento', () => {
    expect(describePurchase('card', card)).toEqual({ label: 'Assinatura ativa', confirm: null, disabled: true });
    const p = describePurchase('pix', card);
    expect(p.confirm).toContain('cancela a cobrança automática');
    expect(p.disabled).toBe(false);
  });

  it('assinatura cancelada (vale até o fim): pode assinar de novo ou pagar Pix, com aviso', () => {
    expect(describePurchase('card', canceled)).toMatchObject({ label: 'Assinar no cartão de novo', disabled: false });
    expect(describePurchase('card', canceled).confirm).toContain('14/11/2026');
    expect(describePurchase('pix', canceled).confirm).toContain('a partir de hoje');
  });

  it('plano liberado manualmente (sem data) não quebra', () => {
    expect(describePurchase('pix', manual).confirm).toContain('sem data definida');
    expect(describePurchase('card', manual).confirm).toContain('sem data definida');
  });
});
