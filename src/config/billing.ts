import type { PlanId } from './plans';

/**
 * Liga os botões de contratação. Fica desligado até as credenciais do Mercado Pago e as Edge Functions
 * estarem configuradas (veja docs/BILLING.md). Com false, a interface avisa que a contratação não está disponível.
 */
export const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true';

/** Planos que podem ser contratados hoje (o servidor aplica a mesma regra). */
export const SELLABLE_PLANS: readonly PlanId[] = ['pro'];

export const PIX_PERIOD_DAYS = 30;
