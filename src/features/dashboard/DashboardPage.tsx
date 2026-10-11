import { useEffect, useMemo, useState } from 'react';
import { Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Field';
import { Money } from '@/components/ui/Money';
import { PLANS } from '@/config/plans';
import { formatDateBR, formatMonthYearBR, monthBounds, shiftMonth, todayISO } from '@/domain/dates';
import { mapDbError } from '@/services/dbErrors';
import { getSummary, listTransactions } from '@/services/transactionService';
import type { Summary, Transaction } from '@/types/db';
import { Loading } from '@/features/workspace/guards';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

type Period = 'month' | 'prev' | 'custom';

const periods: { id: Period; label: string }[] = [
  { id: 'month', label: 'Este mês' },
  { id: 'prev', label: 'Mês passado' },
  { id: 'custom', label: 'Personalizado' },
];

export function DashboardPage() {
  const { workspace, plan, categories, dataVersion } = useWorkspace();
  const business = workspace?.type === 'business';
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = todayISO();
  const range = useMemo(() => {
    if (period === 'month') return monthBounds(today);
    if (period === 'prev') return monthBounds(shiftMonth(today, -1));
    return { from: customFrom, to: customTo };
  }, [period, today, customFrom, customTo]);
  const rangeValid = range.from !== '' && range.to !== '' && range.from <= range.to;

  const wsId = workspace?.id;
  useEffect(() => {
    if (!wsId || !rangeValid) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      getSummary(wsId, range.from, range.to),
      listTransactions(wsId, { search: '', from: null, to: null, categoryId: null, kind: null, sort: 'date_desc', page: 1, pageSize: 5 }),
    ])
      .then(([s, r]) => {
        if (!active) return;
        setSummary(s);
        setRecent(r.rows);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(mapDbError(e));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [wsId, range.from, range.to, rangeValid, dataVersion]);

  const categoryName = (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? 'Sem categoria') : 'Sem categoria');

  const result = summary ? summary.income_cents - summary.expense_cents : 0;
  const hasData = summary !== null && (summary.income_cents > 0 || summary.expense_cents > 0);

  const breakdown = useMemo(() => {
    if (!summary) return [];
    const rows = business ? summary.categories : summary.categories.filter((c) => c.kind === 'expense');
    const total = rows.reduce((acc, c) => acc + c.total_cents, 0);
    const max = rows.reduce((acc, c) => Math.max(acc, c.total_cents), 0);
    return rows.map((c) => ({ ...c, pct: total > 0 ? Math.round((c.total_cents / total) * 100) : 0, width: max > 0 ? (c.total_cents / max) * 100 : 0 }));
  }, [summary, business]);

  const limitedHistory = plan === 'free' && summary !== null && rangeValid && summary.effective_from > range.from;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1">Resumo</h1>
          <p className="mt-1 text-sm text-mute">
            {period === 'month' && formatMonthYearBR(today)}
            {period === 'prev' && formatMonthYearBR(shiftMonth(today, -1))}
            {period === 'custom' && 'Escolha o intervalo de datas'}
          </p>
        </div>
        <div role="group" aria-label="Período" className="inline-flex rounded-md border border-line p-0.5">
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={clsx('rounded px-3 py-1.5 text-sm font-semibold transition-colors', period === p.id ? 'bg-surface2 text-fg' : 'text-mute hover:text-fg')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div className="grid max-w-md grid-cols-2 gap-3">
          <Input label="De" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <Input label="Até" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} error={customFrom && customTo && customFrom > customTo ? 'A data final deve ser depois da inicial.' : undefined} />
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}
      {period === 'custom' && !rangeValid && !error && <Alert tone="info">Informe as duas datas para ver o resumo do intervalo.</Alert>}
      {limitedHistory && <Alert tone="info">O plano {PLANS[plan].name} mostra os últimos {PLANS[plan].limits.historyMonths} meses de histórico. Os dados anteriores continuam guardados.</Alert>}

      {loading && !summary ? (
        <Loading />
      ) : (
        summary && (
          <>
            <section aria-label="Indicadores">
              <p className="text-sm font-semibold uppercase tracking-wide text-faint">{business ? 'Saldo disponível registrado' : 'Saldo registrado'}</p>
              <p className={clsx('num mt-2 text-[2.75rem] font-extrabold leading-none tracking-tight', summary.balance_cents < 0 && 'text-expense')}>
                <Money cents={summary.balance_cents} className="text-[inherit]" />
              </p>
              <p className="mt-2 max-w-xl text-xs text-faint">Saldo inicial somado aos lançamentos que você registrou. Não é o saldo da sua conta bancária.</p>

              <dl className="mt-8 grid grid-cols-1 divide-y divide-line border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="py-4 sm:pr-6">
                  <dt className="text-sm text-mute">Receitas</dt>
                  <dd className="mt-1 text-xl"><Money cents={summary.income_cents} tone="income" /></dd>
                </div>
                <div className="py-4 sm:px-6">
                  <dt className="text-sm text-mute">{business ? 'Despesas operacionais' : 'Despesas'}</dt>
                  <dd className="mt-1 text-xl"><Money cents={summary.expense_cents} tone="expense" /></dd>
                </div>
                <div className="py-4 sm:pl-6">
                  <dt className="text-sm text-mute">{business ? 'Resultado do período' : 'Resultado'}</dt>
                  <dd className="mt-1 text-xl"><Money cents={result} tone="auto" /></dd>
                </div>
              </dl>
            </section>

            {!hasData ? (
              <div className="rounded-lg border border-line">
                <EmptyState icon={Receipt} title="Nenhum lançamento neste período" description='Registre o primeiro na barra acima, por exemplo "50 Uber" ou "Recebi 2500 de salário". Os indicadores aparecem assim que houver dados.' />
              </div>
            ) : (
              <section aria-label={business ? 'Categorias com maior movimentação' : 'Despesas por categoria'}>
                <h2 className="text-h3">{business ? 'Categorias com maior movimentação' : 'Para onde foi o dinheiro'}</h2>
                <ul className="mt-5 space-y-4">
                  {breakdown.map((c) => (
                    <li key={`${c.category_id ?? 'none'}-${c.kind}`}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium">
                          {c.name ?? 'Sem categoria'}
                          {business && <span className={clsx('ml-2 text-xs', c.kind === 'income' ? 'text-income' : 'text-expense')}>{c.kind === 'income' ? 'receita' : 'despesa'}</span>}
                        </span>
                        <span className="num text-mute">
                          <Money cents={c.total_cents} className="text-fg" />
                          {!business && <span className="ml-2 text-xs">{c.pct}%</span>}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
                        <div className={clsx('h-full rounded-full', c.kind === 'income' ? 'bg-income' : 'bg-brand-dark')} style={{ width: `${Math.max(c.width, 2)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {recent.length > 0 && (
              <section aria-label="Últimos lançamentos">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-h3">Últimos lançamentos</h2>
                  <Link to="/app/lancamentos" className="text-sm font-semibold text-brand hover:underline">Ver todos</Link>
                </div>
                <ul className="mt-3 divide-y divide-line/70 border-y border-line">
                  {recent.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{t.description}</span>
                        <span className="text-xs text-faint">{categoryName(t.category_id)} · {formatDateBR(t.occurred_on)}</span>
                      </span>
                      <Money cents={t.kind === 'income' ? t.amount_cents : -t.amount_cents} tone={t.kind} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
