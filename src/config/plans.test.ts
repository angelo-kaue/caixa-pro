import { describe, expect, it } from 'vitest';
import { PLANS, PLAN_ORDER, hasFeature } from './plans';

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
