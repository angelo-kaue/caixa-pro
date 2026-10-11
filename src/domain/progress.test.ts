import { describe, expect, it } from 'vitest';
import { budgetProgress, goalProgress, monthsUntil } from './progress';

describe('budgetProgress', () => {
  it('classifica ok, atenção e estourado', () => {
    expect(budgetProgress(5000, 10000)).toEqual({ pct: 50, remainingCents: 5000, state: 'ok' });
    expect(budgetProgress(8000, 10000).state).toBe('warning');
    expect(budgetProgress(10000, 10000).state).toBe('warning');
    expect(budgetProgress(10001, 10000)).toMatchObject({ state: 'over', remainingCents: -1 });
  });
  it('sem gasto', () => {
    expect(budgetProgress(0, 10000)).toMatchObject({ pct: 0, state: 'ok' });
  });
});

describe('goalProgress', () => {
  const today = '2026-10-10';
  it('calcula porcentagem e restante', () => {
    expect(goalProgress(25000, 100000, null, today)).toEqual({ pct: 25, remainingCents: 75000, completed: false, perMonthCents: null, overdue: false });
  });
  it('meta concluída limita em 100%', () => {
    expect(goalProgress(120000, 100000, null, today)).toMatchObject({ pct: 100, completed: true, remainingCents: 0 });
  });
  it('quanto guardar por mês até a data', () => {
    expect(monthsUntil(today, '2027-04-10')).toBe(6);
    expect(goalProgress(40000, 100000, '2027-04-10', today).perMonthCents).toBe(10000);
    expect(goalProgress(0, 100000, '2026-10-30', today).perMonthCents).toBe(100000);
  });
  it('arredonda para cima e detecta data vencida', () => {
    expect(goalProgress(0, 1000, '2027-01-10', today).perMonthCents).toBe(334);
    expect(goalProgress(10, 1000, '2026-09-01', today)).toMatchObject({ overdue: true, perMonthCents: null });
  });
});
