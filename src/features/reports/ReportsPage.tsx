import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { UpgradeNotice } from '@/components/ui/UpgradeNotice';
import { hasFeature } from '@/config/plans';
import { categoriesToCsv, transactionsToCsv, type ExportCategoryRow, type ExportTransaction } from '@/domain/csv';
import { formatMonthYearBR, monthBounds, shiftMonth, splitISO, todayISO } from '@/domain/dates';
import { formatCentsToBRL } from '@/domain/money';
import { downloadTextFile } from '@/lib/download';
import { useAsyncData } from '@/lib/useAsyncData';
import { mapDbError } from '@/services/dbErrors';
import { getMonthlySeries } from '@/services/planningService';
import { getSummary, listTransactions } from '@/services/transactionService';
import type { SummaryCategory } from '@/types/db';
import { PAYMENT_LABELS } from '@/features/transactions/TransactionForm';
import { Loading } from '@/features/workspace/guards';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

const SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const shortMonth = (iso: string): string => `${SHORT_MONTHS[splitISO(iso).m - 1] ?? ''}/${String(splitISO(iso).y).slice(2)}`;

function delta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '0%' : 'novo';
  const pct = Math.round(((current - previous) * 100) / previous);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

const axisTick = (v: number): string => (v >= 100000 ? `${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)} mil` : String(Math.round(v / 100)));

interface Row {
  key: string;
  name: string;
  kind: 'income' | 'expense';
  current: number;
  previous: number;
}

function mergeCategories(cur: SummaryCategory[], prev: SummaryCategory[]): Row[] {
  const map = new Map<string, Row>();
  const keyOf = (c: SummaryCategory) => `${c.category_id ?? 'none'}-${c.kind}`;
  for (const c of cur) map.set(keyOf(c), { key: keyOf(c), name: c.name ?? 'Sem categoria', kind: c.kind, current: c.total_cents, previous: 0 });
  for (const c of prev) {
    const k = keyOf(c);
    const row = map.get(k);
    if (row) row.previous = c.total_cents;
    else map.set(k, { key: k, name: c.name ?? 'Sem categoria', kind: c.kind, current: 0, previous: c.total_cents });
  }
  return [...map.values()].sort((a, b) => b.current - a.current || b.previous - a.previous);
}

export default function ReportsPage() {
  const { workspace, plan, categories } = useWorkspace();
  const wsId = workspace?.id ?? '';
  const allowed = hasFeature(plan, 'detailedReports');
  const [month, setMonth] = useState(() => shiftMonth(todayISO(), 0));
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'tx' | 'cat' | null>(null);

  const { data, loading, error } = useAsyncData(async () => {
    if (!allowed || !wsId) return null;
    const cur = monthBounds(month);
    const prev = monthBounds(shiftMonth(month, -1));
    const [summary, prevSummary, series] = await Promise.all([getSummary(wsId, cur.from, cur.to), getSummary(wsId, prev.from, prev.to), getMonthlySeries(wsId, 6)]);
    return { summary, prevSummary, series };
  }, [wsId, month, allowed]);

  const rows = useMemo(() => (data ? mergeCategories(data.summary.categories, data.prevSummary.categories) : []), [data]);
  const chartData = useMemo(() => (data ? data.series.map((p) => ({ label: shortMonth(p.month), Receitas: p.income_cents, Despesas: p.expense_cents })) : []), [data]);

  if (!workspace) return null;

  if (!allowed) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Relatórios</h1>
        <UpgradeNotice
          title="Relatórios detalhados fazem parte do plano Pro"
          description="Compare o mês com o anterior, veja a evolução dos últimos 6 meses e exporte seus dados."
          items={['Comparação entre períodos, por categoria', 'Gráfico de receitas e despesas dos últimos 6 meses', 'Exportação de lançamentos e do resumo por categoria em CSV']}
        />
      </div>
    );
  }

  const isCurrentMonth = month >= shiftMonth(todayISO(), 0);
  const catName = (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? '') : 'Sem categoria');

  async function exportTransactions() {
    setExporting('tx');
    setExportError(null);
    try {
      const { from, to } = monthBounds(month);
      const all: ExportTransaction[] = [];
      for (let page = 1; page <= 20; page++) {
        const { rows: batch } = await listTransactions(wsId, { search: '', from, to, categoryId: null, kind: null, sort: 'date_asc', page, pageSize: 1000 });
        for (const t of batch) {
          all.push({ date: t.occurred_on, kind: t.kind, description: t.description, category: catName(t.category_id), payment: t.payment_method ? PAYMENT_LABELS[t.payment_method] : '', amountCents: t.amount_cents });
        }
        if (batch.length < 1000) break;
      }
      downloadTextFile(`caixapro-lancamentos-${month.slice(0, 7)}.csv`, transactionsToCsv(all));
    } catch (e) {
      setExportError(mapDbError(e));
    } finally {
      setExporting(null);
    }
  }

  function exportCategories() {
    const items: ExportCategoryRow[] = rows.map((r) => ({ category: r.name, kind: r.kind, currentCents: r.current, previousCents: r.previous }));
    setExporting('cat');
    downloadTextFile(`caixapro-categorias-${month.slice(0, 7)}.csv`, categoriesToCsv(items));
    setExporting(null);
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="mt-1 text-sm text-mute first-letter:uppercase">{formatMonthYearBR(month)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="secondary" size="sm" aria-label="Próximo mês" disabled={isCurrentMonth} onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {exportError && <Alert tone="error">{exportError}</Alert>}

      {loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            <section aria-label="Comparação com o mês anterior">
              <h2 className="text-h3">Comparação com o mês anterior</h2>
              <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Comparação com o mês anterior">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th></th>
                      <th className="text-right">Este mês</th>
                      <th className="text-right">Mês anterior</th>
                      <th className="text-right">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Receitas', data.summary.income_cents, data.prevSummary.income_cents, 'income'],
                      ['Despesas', data.summary.expense_cents, data.prevSummary.expense_cents, 'expense'],
                      ['Resultado', data.summary.income_cents - data.summary.expense_cents, data.prevSummary.income_cents - data.prevSummary.expense_cents, 'auto'],
                    ].map(([label, cur, prev, tone]) => (
                      <tr key={String(label)}>
                        <td className="font-medium">{label}</td>
                        <td className="text-right"><Money cents={Number(cur)} tone={tone as 'income' | 'expense' | 'auto'} /></td>
                        <td className="text-right"><Money cents={Number(prev)} className="text-mute" /></td>
                        <td className="num text-right text-mute">{delta(Number(cur), Number(prev))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-label="Receitas e despesas dos últimos 6 meses">
              <h2 className="text-h3">Últimos 6 meses</h2>
              <div className="mt-4 h-64 w-full" role="img" aria-label={`Gráfico de barras com receitas e despesas dos últimos 6 meses. ${chartData.map((d) => `${d.label}: receitas ${formatCentsToBRL(d.Receitas)}, despesas ${formatCentsToBRL(d.Despesas)}`).join('; ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barGap={4}>
                    <CartesianGrid stroke="#262626" vertical={false} />
                    <XAxis dataKey="label" stroke="#8A8A8A" tickLine={false} axisLine={{ stroke: '#262626' }} fontSize={12} />
                    <YAxis stroke="#8A8A8A" tickLine={false} axisLine={false} fontSize={12} tickFormatter={axisTick} width={58} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: '#111111', border: '1px solid #363636', borderRadius: 8, color: '#fff' }} formatter={(v: number) => formatCentsToBRL(v)} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#A3A3A3' }} />
                    <Bar dataKey="Receitas" fill="#22C55E" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Despesas" fill="#F87171" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-faint">Valores em reais (eixo em R$).</p>
            </section>

            <section aria-label="Categorias">
              <h2 className="text-h3">Por categoria</h2>
              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-mute">Sem movimentação neste mês nem no anterior.</p>
              ) : (
                <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Valores por categoria">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th>Tipo</th>
                        <th className="text-right">Este mês</th>
                        <th className="text-right">Mês anterior</th>
                        <th className="text-right">Variação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.key}>
                          <td className="font-medium">{r.name}</td>
                          <td className={r.kind === 'income' ? 'text-income' : 'text-expense'}>{r.kind === 'income' ? 'Receita' : 'Despesa'}</td>
                          <td className="text-right"><Money cents={r.current} /></td>
                          <td className="text-right"><Money cents={r.previous} className="text-mute" /></td>
                          <td className="num text-right text-mute">{delta(r.current, r.previous)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section aria-label="Exportação" className="border-t border-line pt-6">
              <h2 className="text-h3">Exportar</h2>
              <p className="mt-1 text-sm text-mute">Arquivos CSV prontos para abrir no Excel ou no Google Planilhas.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="secondary" loading={exporting === 'tx'} onClick={() => void exportTransactions()}>
                  <Download size={16} aria-hidden="true" /> Lançamentos do mês
                </Button>
                <Button variant="secondary" loading={exporting === 'cat'} disabled={rows.length === 0} onClick={exportCategories}>
                  <Download size={16} aria-hidden="true" /> Resumo por categoria
                </Button>
              </div>
            </section>
          </>
        )
      )}
    </div>
  );
}
