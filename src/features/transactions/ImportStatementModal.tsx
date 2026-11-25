import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import clsx from 'clsx';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Money } from '@/components/ui/Money';
import { PLANS } from '@/config/plans';
import { suggestCategory, type Kind } from '@/domain/categorizer';
import { formatDateBR, monthBounds, shiftMonth, todayISO } from '@/domain/dates';
import {
  MAX_ROWS,
  buildReview,
  extractCsvRows,
  loadStatementFile,
  type CsvMapping,
  type CsvPrepared,
  type ExistingTx,
  type ParsedRow,
  type ReviewRow,
  type RowStatus,
} from '@/domain/statement';
import { mapDbError } from '@/services/dbErrors';
import { fetchExistingForImport, importTransactions, type ImportResult } from '@/services/statementService';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

type Step = 'pick' | 'map' | 'review' | 'done';

const control =
  'h-9 w-full rounded-md border border-line bg-canvas2 px-3 text-sm text-fg transition-colors focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50';

const STATUS_LABEL: Record<RowStatus, string> = { new: 'Nova', duplicate: 'Já importada', possible: 'Parece já lançada' };
const STATUS_TONE: Record<RowStatus, 'income' | 'neutral' | 'warn'> = { new: 'income', duplicate: 'neutral', possible: 'warn' };

const emptyDraft = { date: '', description: '', amount: '', debit: '', credit: '', id: '' };
type Draft = typeof emptyDraft;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportStatementModal({ open, onClose }: Props) {
  const { workspace, plan, categories, userRules, findCategory, bump } = useWorkspace();
  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState<CsvPrepared | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [accountId, setAccountId] = useState<string | undefined>();
  const [isCsv, setIsCsv] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [existing, setExisting] = useState<ExistingTx[]>([]);
  const [invert, setInvert] = useState(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  // Muda a cada fechamento: respostas de operações iniciadas antes de fechar são descartadas.
  const session = useRef(0);

  useEffect(() => {
    if (open) return;
    session.current += 1;
    setStep('pick');
    setError('');
    setFileName('');
    setCsv(null);
    setDraft(emptyDraft);
    setParsed([]);
    setRows([]);
    setExisting([]);
    setInvert(false);
    setSkipped(0);
    setResult(null);
  }, [open]);

  const wsId = workspace?.id;

  const categorize = (description: string, kind: Kind): string | null =>
    findCategory(kind, suggestCategory(description, kind, userRules).category)?.id ?? null;

  const selected = useMemo(() => rows.filter((r) => r.selected), [rows]);
  const count = (s: RowStatus) => rows.filter((r) => r.status === s).length;

  // Aviso (aproximado) de que o plano Free pode recusar parte do arquivo.
  const planWarning = useMemo(() => {
    if (plan !== 'free') return null;
    const { maxTransactionsPerMonth: perMonth, historyMonths } = PLANS.free.limits;
    if (perMonth === null || historyMonths === null) return null;
    const cutoff = shiftMonth(monthBounds(todayISO()).from, -(historyMonths - 1));
    const perMonthCount = new Map<string, number>();
    let old = 0;
    for (const r of selected) {
      if (r.date < cutoff) old++;
      const m = r.date.slice(0, 7);
      perMonthCount.set(m, (perMonthCount.get(m) ?? 0) + 1);
    }
    const over = [...perMonthCount.values()].some((n) => n > perMonth);
    if (old === 0 && !over) return null;
    return `O plano Free aceita até ${perMonth} lançamentos por mês e os últimos ${historyMonths} meses de histórico. O que passar disso será recusado; o Pro não tem esses limites.`;
  }, [plan, selected]);

  async function run(fn: (isCurrent: () => boolean) => Promise<void>) {
    const id = session.current;
    const isCurrent = () => id === session.current;
    setBusy(true);
    setError('');
    try {
      await fn(isCurrent);
    } catch (e) {
      if (isCurrent()) setError(e instanceof Error && !('code' in e) ? e.message : mapDbError(e));
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }

  async function startReview(list: ParsedRow[], acct: string | undefined, csvSource: boolean, skip: number, isCurrent: () => boolean) {
    if (!wsId) throw new Error('Espaço de trabalho não encontrado. Recarregue a página.');
    if (list.length === 0) throw new Error('Nenhum lançamento válido foi encontrado no arquivo.');
    if (list.length > MAX_ROWS) {
      throw new Error(`O arquivo tem ${list.length} lançamentos. O limite é ${MAX_ROWS}; exporte um período menor.`);
    }
    const dates = list.map((r) => r.date).sort();
    const ex = await fetchExistingForImport(wsId, dates[0] ?? '', dates[dates.length - 1] ?? '');
    if (!isCurrent()) return;
    setExisting(ex);
    setParsed(list);
    setAccountId(acct);
    setIsCsv(csvSource);
    setSkipped(skip);
    setInvert(false);
    setRows(buildReview(list, ex, { invert: false, categorize, ...(acct ? { accountId: acct } : {}) }));
    setStep('review');
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    void run(async (isCurrent) => {
      const loaded = await loadStatementFile(file);
      if (!isCurrent()) return;
      if (loaded.kind === 'ofx') {
        await startReview(loaded.statement.rows, loaded.statement.accountId, false, loaded.statement.skipped, isCurrent);
        return;
      }
      const { table, headerIndex, mapping } = loaded.prepared;
      setCsv(loaded.prepared);
      if (mapping) {
        const ext = extractCsvRows(table, headerIndex, mapping);
        await startReview(ext.rows, undefined, true, ext.skipped, isCurrent);
      } else {
        setDraft(emptyDraft);
        setStep('map');
      }
    });
  }

  function confirmMapping() {
    if (!csv) return;
    const idx = (v: string) => (v === '' ? null : Number(v));
    const mapping: CsvMapping = {
      date: Number(draft.date),
      description: Number(draft.description),
      amount: idx(draft.amount),
      debit: idx(draft.debit),
      credit: idx(draft.credit),
      id: idx(draft.id),
    };
    void run(async (isCurrent) => {
      const ext = extractCsvRows(csv.table, csv.headerIndex, mapping);
      await startReview(ext.rows, undefined, true, ext.skipped, isCurrent);
    });
  }

  function toggleInvert(v: boolean) {
    setInvert(v);
    setRows(buildReview(parsed, existing, { invert: v, categorize, ...(accountId ? { accountId } : {}) }));
  }

  const patch = (id: string, p: Partial<ReviewRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const setAll = (fn: (r: ReviewRow) => boolean) => setRows((rs) => rs.map((r) => ({ ...r, selected: fn(r) })));

  function save() {
    if (!wsId) return;
    void run(async (isCurrent) => {
      const res = await importTransactions(wsId, selected);
      if (res.inserted > 0) bump();
      if (!isCurrent()) return;
      setResult(res);
      setStep('done');
    });
  }

  const headers = csv?.table[csv.headerIndex] ?? [];
  const mapOk = draft.date !== '' && draft.description !== '' && (draft.amount !== '' || draft.debit !== '' || draft.credit !== '');

  function columnSelect(key: keyof Draft, label: string, required: boolean) {
    return (
      <div className="space-y-1.5">
        <label htmlFor={`imp-${key}`} className="block text-sm font-medium text-fg">
          {label}
        </label>
        <select id={`imp-${key}`} className={control} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}>
          <option value="">{required ? 'Escolha a coluna' : 'Nenhuma'}</option>
          {headers.map((h, i) => (
            <option key={i} value={i}>
              {h.trim() || `Coluna ${i + 1}`}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const subtitle =
    step === 'pick'
      ? 'Envie o arquivo CSV ou OFX do app do seu banco. Nada é salvo antes da sua revisão.'
      : step === 'map'
        ? 'Não reconhecemos as colunas automaticamente. Diga qual é qual.'
        : step === 'review'
          ? `${fileName}: confira e ajuste antes de salvar.`
          : '';

  return (
    <Modal open={open} title="Importar extrato" onClose={onClose} size="lg">
      <div className="space-y-4">
        {subtitle && <p className="text-sm text-mute">{subtitle}</p>}
        {error && <Alert tone="error">{error}</Alert>}

        {step === 'pick' && (
          <label
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-line2 p-10 text-center transition-colors focus-within:border-brand hover:border-brand"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFile(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={22} className="text-brand" aria-hidden="true" />
            <span className="font-semibold">{busy ? 'Lendo o arquivo...' : 'Escolher arquivo ou arrastar aqui'}</span>
            <span className="text-sm text-faint">.csv, .ofx ou .qfx, até 5 MB</span>
            <input
              type="file"
              accept=".csv,.ofx,.qfx,.txt,text/csv"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        )}

        {step === 'map' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {columnSelect('date', 'Data', true)}
              {columnSelect('description', 'Descrição', true)}
              {columnSelect('amount', 'Valor (entradas e saídas na mesma coluna)', false)}
              {columnSelect('id', 'Identificador único (se houver)', false)}
              {columnSelect('debit', 'Saídas (se estiverem em outra coluna)', false)}
              {columnSelect('credit', 'Entradas (se estiverem em outra coluna)', false)}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep('pick')} disabled={busy}>
                Voltar
              </Button>
              <Button onClick={confirmMapping} disabled={!mapOk} loading={busy}>
                Continuar
              </Button>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="income">{count('new')} novas</Badge>
              <Badge tone="warn">{count('possible')} parecem já lançadas</Badge>
              <Badge>{count('duplicate')} já importadas</Badge>
              {skipped > 0 && <span className="text-xs text-faint">{skipped} linhas ignoradas (saldos e cabeçalhos)</span>}
            </div>

            {planWarning && <Alert tone="info">{planWarning}</Alert>}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setAll((r) => r.status === 'new')}>
                Só as novas
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setAll(() => true)}>
                Todas
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setAll(() => false)}>
                Nenhuma
              </Button>
              {isCsv && (
                <label className="ml-auto flex items-center gap-2 text-sm text-mute">
                  <input type="checkbox" className="h-4 w-4 accent-brand" checked={invert} onChange={(e) => toggleInvert(e.target.checked)} />
                  Inverter entradas e saídas
                </label>
              )}
            </div>

            <ul className="space-y-2" aria-label="Lançamentos do arquivo">
              {rows.map((r) => (
                <li key={r.id} className={clsx('rounded-md border p-3', r.selected ? 'border-line2 bg-surface2/50' : 'border-line opacity-60')}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-2.5 h-4 w-4 shrink-0 accent-brand"
                      checked={r.selected}
                      onChange={(e) => patch(r.id, { selected: e.target.checked })}
                      aria-label={`Importar ${r.description}`}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start gap-3">
                        <input
                          className={control}
                          value={r.description}
                          maxLength={140}
                          onChange={(e) => patch(r.id, { description: e.target.value })}
                          aria-label="Descrição"
                        />
                        <span className="shrink-0 pt-1.5 text-sm">
                          <Money cents={r.kind === 'income' ? r.cents : -r.cents} tone={r.kind} />
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
                        <span className="num">{formatDateBR(r.date)}</span>
                        <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                        <select
                          className={clsx(control, 'h-8 w-auto text-xs')}
                          value={r.kind}
                          aria-label="Tipo"
                          onChange={(e) => {
                            const kind = e.target.value as Kind;
                            patch(r.id, { kind, categoryId: categorize(r.description, kind) });
                          }}
                        >
                          <option value="expense">Despesa</option>
                          <option value="income">Receita</option>
                        </select>
                        <select
                          className={clsx(control, 'h-8 w-auto max-w-[12rem] text-xs')}
                          value={r.categoryId ?? ''}
                          aria-label="Categoria"
                          onChange={(e) => patch(r.id, { categoryId: e.target.value || null })}
                        >
                          <option value="">Sem categoria</option>
                          {categories
                            .filter((c) => c.kind === r.kind)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line bg-surface p-4">
              <Button variant="ghost" onClick={() => setStep('pick')} disabled={busy}>
                Trocar arquivo
              </Button>
              <Button onClick={save} loading={busy} disabled={selected.length === 0}>
                Importar {selected.length} {selected.length === 1 ? 'lançamento' : 'lançamentos'}
              </Button>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <p className="text-h3 text-brand">
              {result.inserted} {result.inserted === 1 ? 'lançamento importado' : 'lançamentos importados'}
            </p>
            {result.duplicates > 0 && (
              <Alert>{result.duplicates} já existiam e foram ignorados pela trava anti-duplicidade.</Alert>
            )}
            {result.monthlyBlocked > 0 && (
              <Alert tone="error">
                {result.monthlyBlocked} não couberam no limite de {PLANS.free.limits.maxTransactionsPerMonth} lançamentos por mês do plano Free.
              </Alert>
            )}
            {result.historyBlocked > 0 && (
              <Alert tone="error">
                {result.historyBlocked} estão fora do histórico do plano Free (últimos {PLANS.free.limits.historyMonths} meses).
              </Alert>
            )}
            {result.failed > 0 && <Alert tone="error">{result.failed} não foram salvos. {result.firstError}</Alert>}
            <div className="flex justify-end">
              <Button onClick={onClose}>Fechar</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
