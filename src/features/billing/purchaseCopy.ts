import type { PlanId } from '@/config/plans';
import { PIX_PERIOD_DAYS } from '@/config/billing';
import { addDays, formatDateBR, toISODate } from '@/domain/dates';

export interface PurchaseContext {
  plan: PlanId;
  status: string | null;
  billingMode: 'card' | 'pix' | null;
  /** ISO do fim do período pago (ou null). */
  accessUntil: string | null;
}

export interface PurchaseCopy {
  label: string;
  /** Texto de confirmação; null = pode seguir direto para o pagamento. */
  confirm: string | null;
  disabled: boolean;
}

const fmt = (iso: string | null): string => (iso ? formatDateBR(toISODate(new Date(iso))) : 'sem data definida');

/** O que mostrar nos botões de compra e o que avisar antes de seguir, conforme o plano atual. */
export function describePurchase(mode: 'card' | 'pix', c: PurchaseContext): PurchaseCopy {
  const hasPaid = c.plan !== 'free';
  const until = fmt(c.accessUntil);
  const active = c.status === 'active';

  if (mode === 'card') {
    if (!hasPaid) return { label: 'Assinar no cartão (mensal)', confirm: null, disabled: false };
    if (c.billingMode === 'card' && active) return { label: 'Assinatura ativa', confirm: null, disabled: true };
    if (c.billingMode === 'pix' && active) {
      return {
        label: 'Passar para o cartão (mensal)',
        confirm: `Você já tem o Pro até ${until}, pago por Pix. Ao assinar no cartão, a cobrança mensal começa hoje e o acesso passa a seguir esse ciclo (renova sozinho). Os dias que sobraram do Pix não são somados.`,
        disabled: false,
      };
    }
    return {
      label: 'Assinar no cartão de novo',
      confirm: `Seu Pro vale até ${until}. Uma nova assinatura no cartão começa a cobrança mensal hoje.`,
      disabled: false,
    };
  }

  if (!hasPaid) return { label: `Pagar ${PIX_PERIOD_DAYS} dias com Pix`, confirm: null, disabled: false };
  if (c.billingMode === 'pix' && active) {
    const next = c.accessUntil ? formatDateBR(addDays(toISODate(new Date(c.accessUntil)), PIX_PERIOD_DAYS)) : null;
    return {
      label: `Renovar com Pix (+${PIX_PERIOD_DAYS} dias)`,
      confirm: `Seu Pro vale até ${until}. Este pagamento soma ${PIX_PERIOD_DAYS} dias ao período atual${next ? `, e o acesso passa a valer até ${next}` : ''}.`,
      disabled: false,
    };
  }
  if (c.billingMode === 'card' && active) {
    return {
      label: `Pagar ${PIX_PERIOD_DAYS} dias com Pix`,
      confirm: `Você tem uma assinatura mensal no cartão ativa. Pagar com Pix cancela a cobrança automática do cartão e libera ${PIX_PERIOD_DAYS} dias a partir de hoje.`,
      disabled: false,
    };
  }
  return {
    label: `Pagar ${PIX_PERIOD_DAYS} dias com Pix`,
    confirm: `Seu Pro vale até ${until}. Este pagamento libera ${PIX_PERIOD_DAYS} dias a partir de hoje.`,
    disabled: false,
  };
}
