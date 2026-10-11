import { splitISO } from './dates';

export type BudgetState = 'ok' | 'warning' | 'over';

/** Progresso de um orçamento mensal. Só aritmética inteira. */
export function budgetProgress(spentCents: number, limitCents: number): { pct: number; remainingCents: number; state: BudgetState } {
  const pct = limitCents > 0 ? Math.floor((spentCents * 100) / limitCents) : 0;
  const state: BudgetState = spentCents > limitCents ? 'over' : pct >= 80 ? 'warning' : 'ok';
  return { pct, remainingCents: limitCents - spentCents, state };
}

export interface GoalProgress {
  /** 0 a 100 (limitado). */
  pct: number;
  remainingCents: number;
  completed: boolean;
  /** Quanto guardar por mês até a data-alvo; null sem data, concluída ou data vencida. */
  perMonthCents: number | null;
  overdue: boolean;
}

export function monthsUntil(todayIso: string, targetIso: string): number {
  const a = splitISO(todayIso);
  const b = splitISO(targetIso);
  return (b.y - a.y) * 12 + (b.m - a.m);
}

export function goalProgress(currentCents: number, targetCents: number, targetDate: string | null, todayIso: string): GoalProgress {
  const completed = currentCents >= targetCents;
  const remainingCents = Math.max(0, targetCents - currentCents);
  const pct = targetCents > 0 ? Math.min(100, Math.floor((currentCents * 100) / targetCents)) : 0;
  let perMonthCents: number | null = null;
  let overdue = false;
  if (targetDate && !completed) {
    if (targetDate < todayIso) overdue = true;
    else perMonthCents = Math.ceil(remainingCents / Math.max(1, monthsUntil(todayIso, targetDate)));
  }
  return { pct, remainingCents, completed, perMonthCents, overdue };
}
