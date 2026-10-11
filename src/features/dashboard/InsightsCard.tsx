import { useMemo } from 'react';
import clsx from 'clsx';
import { monthBounds, shiftMonth, todayISO } from '@/domain/dates';
import { generateInsights, type BudgetStatus, type CategoryTotal } from '@/domain/insights';
import { useAsyncData } from '@/lib/useAsyncData';
import { listBudgets } from '@/services/planningService';
import { getSummary } from '@/services/transactionService';
import type { SummaryCategory } from '@/types/db';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

const toTotals = (cats: SummaryCategory[]): CategoryTotal[] => cats.map((c) => ({ name: c.name ?? 'Sem categoria', kind: c.kind, totalCents: c.total_cents }));

/** Insights do mês (plano Pro): cada frase vem de uma conta simples sobre os lançamentos. */
export function InsightsCard() {
  const { workspace, categories, dataVersion } = useWorkspace();
  const wsId = workspace?.id ?? '';
  const { data } = useAsyncData(async () => {
    const today = todayISO();
    const cur = monthBounds(today);
    const prev = monthBounds(shiftMonth(today, -1));
    const [s, p, budgets] = await Promise.all([getSummary(wsId, cur.from, cur.to), getSummary(wsId, prev.from, prev.to), listBudgets(wsId)]);
    return { s, p, budgets };
  }, [wsId, dataVersion]);

  const insights = useMemo(() => {
    if (!data) return [];
    const spent = new Map(data.s.categories.filter((c) => c.kind === 'expense' && c.category_id).map((c) => [c.category_id as string, c.total_cents]));
    const budgets: BudgetStatus[] = data.budgets
      .filter((b) => b.active)
      .map((b) => ({ categoryName: categories.find((c) => c.id === b.category_id)?.name ?? '', limitCents: b.amount_cents, spentCents: spent.get(b.category_id) ?? 0 }))
      .filter((b) => b.categoryName !== '');
    const hasPrev = data.p.income_cents + data.p.expense_cents > 0;
    return generateInsights({
      current: { incomeCents: data.s.income_cents, expenseCents: data.s.expense_cents },
      previous: hasPrev ? { incomeCents: data.p.income_cents, expenseCents: data.p.expense_cents } : null,
      categories: toTotals(data.s.categories),
      previousCategories: toTotals(data.p.categories),
      budgets,
    });
  }, [data, categories]);

  if (insights.length === 0) return null;

  return (
    <section aria-label="Insights do mês">
      <h2 className="text-h3">Insights do mês</h2>
      <p className="mt-1 text-xs text-faint">Calculados a partir dos seus lançamentos, sem inteligência artificial.</p>
      <ul className="mt-4 space-y-2.5">
        {insights.map((i) => (
          <li key={i.id} className={clsx('border-l-2 py-0.5 pl-3.5 text-sm', i.tone === 'warn' && 'border-warn', i.tone === 'good' && 'border-income', i.tone === 'info' && 'border-line2')}>
            {i.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
