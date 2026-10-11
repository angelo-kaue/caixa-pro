import { formatCentsToBRL } from './money';

export interface PeriodTotals {
  incomeCents: number;
  expenseCents: number;
}

export interface CategoryTotal {
  name: string;
  kind: 'income' | 'expense';
  totalCents: number;
}

export interface BudgetStatus {
  categoryName: string;
  limitCents: number;
  spentCents: number;
}

export interface InsightInput {
  current: PeriodTotals;
  previous: PeriodTotals | null;
  categories: CategoryTotal[];
  previousCategories: CategoryTotal[];
  budgets: BudgetStatus[];
}

export interface Insight {
  id: string;
  tone: 'good' | 'warn' | 'info';
  text: string;
}

const pctChange = (from: number, to: number): number => Math.round(((to - from) * 100) / from);

/** Insights calculados por regras a partir dos lançamentos. Não há IA: cada frase vem de uma conta simples. */
export function generateInsights(input: InsightInput, max = 5): Insight[] {
  const out: (Insight & { priority: number })[] = [];
  const { current, previous } = input;
  const result = current.incomeCents - current.expenseCents;

  if (current.incomeCents + current.expenseCents === 0) return [];

  for (const b of input.budgets) {
    if (b.spentCents > b.limitCents) {
      out.push({ id: `budget-over-${b.categoryName}`, priority: 1, tone: 'warn', text: `O orçamento de ${b.categoryName} foi ultrapassado em ${formatCentsToBRL(b.spentCents - b.limitCents)}.` });
    } else {
      const pct = Math.floor((b.spentCents * 100) / b.limitCents);
      if (pct >= 80) out.push({ id: `budget-near-${b.categoryName}`, priority: 2, tone: 'warn', text: `O orçamento de ${b.categoryName} já usou ${pct}% do limite.` });
    }
  }

  if (result < 0) {
    out.push({ id: 'negative-result', priority: 1, tone: 'warn', text: `Neste mês as despesas superaram as receitas em ${formatCentsToBRL(-result)}.` });
  }

  if (previous && previous.expenseCents > 0 && current.expenseCents > 0) {
    const change = pctChange(previous.expenseCents, current.expenseCents);
    if (Math.abs(change) >= 10) {
      out.push({
        id: 'expense-change',
        priority: 3,
        tone: change > 0 ? 'warn' : 'good',
        text: `Suas despesas ${change > 0 ? 'subiram' : 'caíram'} ${Math.abs(change)}% em relação ao mês passado (${formatCentsToBRL(previous.expenseCents)} → ${formatCentsToBRL(current.expenseCents)}).`,
      });
    }
  }

  const expenses = input.categories.filter((c) => c.kind === 'expense' && c.totalCents > 0).sort((a, b) => b.totalCents - a.totalCents);
  const totalExpense = expenses.reduce((acc, c) => acc + c.totalCents, 0);
  const top = expenses[0];
  if (top && totalExpense > 0 && expenses.length > 1) {
    out.push({ id: 'top-category', priority: 4, tone: 'info', text: `${top.name} é sua maior despesa do mês: ${Math.round((top.totalCents * 100) / totalExpense)}% do total (${formatCentsToBRL(top.totalCents)}).` });
  }

  const prevByName = new Map(input.previousCategories.filter((c) => c.kind === 'expense').map((c) => [c.name, c.totalCents]));
  let biggest: { name: string; pct: number; delta: number } | null = null;
  for (const c of expenses) {
    const prev = prevByName.get(c.name);
    if (!prev || prev <= 0) continue;
    const delta = c.totalCents - prev;
    const pct = pctChange(prev, c.totalCents);
    if (delta >= 5000 && pct >= 30 && (!biggest || delta > biggest.delta)) biggest = { name: c.name, pct, delta };
  }
  if (biggest) {
    out.push({ id: 'category-up', priority: 3, tone: 'warn', text: `Os gastos com ${biggest.name} subiram ${biggest.pct}% em relação ao mês passado (+${formatCentsToBRL(biggest.delta)}).` });
  }

  if (current.incomeCents > 0 && result > 0) {
    out.push({ id: 'savings', priority: 5, tone: 'good', text: `Você ficou com ${Math.round((result * 100) / current.incomeCents)}% da receita deste mês (${formatCentsToBRL(result)}).` });
  }

  return out
    .sort((a, b) => a.priority - b.priority)
    .slice(0, max)
    .map(({ priority: _priority, ...rest }) => rest);
}
