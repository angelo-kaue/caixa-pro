import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PLANS, PLAN_ORDER, hasFeature, type PlanId } from './plans';

describe('catálogo de planos', () => {
  it('define os três planos na ordem esperada', () => {
    expect(PLAN_ORDER).toEqual(['free', 'pro', 'enterprise']);
    for (const id of PLAN_ORDER) expect(PLANS[id].id).toBe(id);
  });

  it('preços em centavos, inteiros e crescentes', () => {
    const prices = PLAN_ORDER.map((id) => PLANS[id].priceCents);
    expect(prices).toEqual([0, 1990, 7990]);
    prices.forEach((p) => expect(Number.isInteger(p)).toBe(true));
  });

  it('Free tem os limites especificados', () => {
    expect(PLANS.free.limits).toEqual({
      maxTransactionsPerMonth: 100,
      historyMonths: 3,
      maxActiveBudgets: 3,
      maxMembers: 1,
    });
  });

  it('recursos de equipe só existem no Enterprise', () => {
    expect(hasFeature('free', 'multiUser')).toBe(false);
    expect(hasFeature('pro', 'multiUser')).toBe(false);
    expect(hasFeature('enterprise', 'multiUser')).toBe(true);
    expect(hasFeature('pro', 'export')).toBe(true);
    expect(hasFeature('free', 'export')).toBe(false);
  });
});

describe('sincronia entre plans.ts e o banco', () => {
  const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/0005_planning_features.sql'), 'utf8');
  const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  const dbFeatures = (plan: string): string[] => {
    const m = new RegExp(`set features = array\\[([^\\]]*)\\] where id = '${plan}'`).exec(sql);
    return (m?.[1] ?? '').split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean).sort();
  };
  const clientFeatures = (plan: PlanId): string[] =>
    Object.entries(PLANS[plan].features).filter(([, on]) => on).map(([k]) => snake(k)).sort();

  it.each(['pro', 'enterprise'] as const)('recursos do plano %s são iguais no front e no banco', (plan) => {
    expect(dbFeatures(plan).length).toBeGreaterThan(0);
    expect(clientFeatures(plan)).toEqual(dbFeatures(plan));
  });

  it('limites do Free no front batem com a tabela plans', () => {
    const initial = readFileSync(resolve(__dirname, '../../supabase/migrations/0001_core_schema.sql'), 'utf8');
    const { maxTransactionsPerMonth, historyMonths, maxActiveBudgets, maxMembers } = PLANS.free.limits;
    expect(initial).toContain(`('free', 'Free', 0, ${maxTransactionsPerMonth}, ${historyMonths}, ${maxActiveBudgets}, ${maxMembers})`);
  });
});
