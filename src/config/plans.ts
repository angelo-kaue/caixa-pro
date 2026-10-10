/**
 * Catálogo central de planos. É a ÚNICA fonte de preços, limites e recursos no front-end.
 * Os limites reais são aplicados no banco (tabela `plans` + triggers, ver supabase/migrations).
 * Qualquer alteração aqui deve ser espelhada na migração correspondente.
 * Preços iniciais são para experimentação e sujeitos a validação comercial.
 */

export type PlanId = 'free' | 'pro' | 'enterprise';

export type FeatureKey =
  | 'advancedCharts'
  | 'periodComparison'
  | 'insights'
  | 'goals'
  | 'recurring'
  | 'export'
  | 'detailedReports'
  | 'multiUser'
  | 'roles'
  | 'multiCash'
  | 'consolidatedReports'
  | 'audit';

export interface PlanLimits {
  /** null = ilimitado */
  maxTransactionsPerMonth: number | null;
  historyMonths: number | null;
  maxActiveBudgets: number | null;
  maxMembers: number | null;
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  tagline: string;
  priceCents: number;
  /** Quando true, o preço é exibido como "a partir de". */
  priceIsStartingAt: boolean;
  limits: PlanLimits;
  features: Record<FeatureKey, boolean>;
  /** Lista exibida na página de preços. */
  highlights: string[];
}

const none: Record<FeatureKey, boolean> = {
  advancedCharts: false,
  periodComparison: false,
  insights: false,
  goals: false,
  recurring: false,
  export: false,
  detailedReports: false,
  multiUser: false,
  roles: false,
  multiCash: false,
  consolidatedReports: false,
  audit: false,
};

const proFeatures: Record<FeatureKey, boolean> = {
  ...none,
  advancedCharts: true,
  periodComparison: true,
  insights: true,
  goals: true,
  recurring: true,
  export: true,
  detailedReports: true,
};

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Para começar a organizar o dinheiro.',
    priceCents: 0,
    priceIsStartingAt: false,
    limits: { maxTransactionsPerMonth: 100, historyMonths: 3, maxActiveBudgets: 3, maxMembers: 1 },
    features: { ...none },
    highlights: [
      'Até 100 lançamentos por mês',
      'Histórico de 3 meses',
      'Dashboard básico',
      'Categorização automática por regras',
      'Resumo mensal',
      'Até 3 orçamentos ativos',
      'Uma pessoa por espaço de trabalho',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Para quem quer entender e melhorar os números.',
    priceCents: 1990,
    priceIsStartingAt: false,
    limits: { maxTransactionsPerMonth: null, historyMonths: null, maxActiveBudgets: null, maxMembers: 1 },
    features: { ...proFeatures },
    highlights: [
      'Lançamentos ilimitados',
      'Histórico completo',
      'Gráficos avançados e comparação entre períodos',
      'Insights financeiros',
      'Orçamentos ilimitados e metas financeiras',
      'Recorrências',
      'Exportação e relatórios detalhados',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Para negócios com mais de uma pessoa ou unidade.',
    priceCents: 7990,
    priceIsStartingAt: true,
    limits: { maxTransactionsPerMonth: null, historyMonths: null, maxActiveBudgets: null, maxMembers: null },
    features: {
      ...proFeatures,
      multiUser: true,
      roles: true,
      multiCash: true,
      consolidatedReports: true,
      audit: true,
    },
    highlights: [
      'Tudo do Pro',
      'Múltiplos usuários com convites',
      'Papéis e permissões',
      'Múltiplos caixas ou unidades',
      'Relatórios consolidados',
      'Auditoria de alterações',
    ],
  },
};

export const PLAN_ORDER: readonly PlanId[] = ['free', 'pro', 'enterprise'];

export function hasFeature(plan: PlanId, feature: FeatureKey): boolean {
  return PLANS[plan].features[feature];
}
