import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Receipt, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Money } from '@/components/ui/Money';
import type { Kind } from '@/domain/categorizer';
import { ruleKeywordFromDescription } from '@/domain/categorizer';
import { formatDateBR, formatRelativeDate, todayISO } from '@/domain/dates';
import { formatCentsForInput, formatCentsToBRL } from '@/domain/money';
import { mapDbError } from '@/services/dbErrors';
import { deleteTransaction, listTransactions, updateTransaction, type SortKey, type TxFilters } from '@/services/transactionService';
import { saveRule } from '@/services/workspaceService';
import type { Transaction } from '@/types/db';
import { Loading } from '@/features/workspace/guards';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { TransactionForm } from './TransactionForm';

const PAGE_SIZE = 20;

interface Filters {
  kind: Kind | '';
  categoryId: string;
  from: string;
  to: string;
  sort: SortKey;
}
const initialFilters: Filters = { kind: '', categoryId: '', from: '', to: '', sort: 'date_desc' };

export function TransactionsPage() {
  const { workspace, categories, dataVersion, bump } = useWorkspace();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const wsId = workspace?.id;
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const filtering = search !== '' || filters.kind !== '' || filters.categoryId !== '' || filters.from !== '' || filters.to !== '';
  const dateRangeInvalid = filters.from !== '' && filters.to !== '' && filters.from > filters.to;

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!wsId || dateRangeInvalid) return;
    let active = true;
    setLoading(true);
    setError(null);
    const f: TxFilters = {
      search,
      from: filters.from || null,
      to: filters.to || null,
      categoryId: filters.categoryId || null,
      kind: filters.kind || null,
      sort: filters.sort,
      page,
      pageSize: PAGE_SIZE,
    };
    listTransactions(wsId, f)
      .then(({ rows: r, total: t }) => {
        if (!active) return;
        if (r.length === 0 && page > 1) {
          setPage(page - 1);
          return;
        }
        setRows(r);
        setTotal(t);
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
  }, [wsId, search, filters, page, dataVersion, dateRangeInvalid, retry]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters(initialFilters);
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);
  const categoryOptions = categories.filter((c) => !filters.kind || c.kind === filters.kind);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteTransaction(deleting.id);
      setDeleting(null);
      bump();
    } catch (e) {
      setDeleteError(mapDbError(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">Lançamentos</h1>

      <section aria-label="Filtros" className="space-y-3">
        <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <Input label="Buscar por descrição" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-9" placeholder="Ex.: Uber" />
          <Search size={16} className="pointer-events-none absolute bottom-3 left-3 text-faint" aria-hidden="true" />
        </div>
          <Button variant="secondary" className="sm:hidden" aria-expanded={showFilters} aria-controls="filtros-extras" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal size={16} aria-hidden="true" /> Filtros
          </Button>
        </div>
        <div id="filtros-extras" className={clsx('gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-5', showFilters ? 'grid' : 'hidden')}>

        <Select label="Tipo" value={filters.kind} onChange={(e) => setFilters((p) => ({ ...p, kind: e.target.value as Kind | '', categoryId: '' }))}>
          <option value="">Todos</option>
          <option value="expense">Despesas</option>
          <option value="income">Receitas</option>
        </Select>
        <Select label="Categoria" value={filters.categoryId} onChange={(e) => setFilter('categoryId', e.target.value)}>
          <option value="">Todas</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Input label="De" type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        <Input label="Até" type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} error={dateRangeInvalid ? 'Data final antes da inicial.' : undefined} />
        <Select label="Ordenar por" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value as SortKey)}>
          <option value="date_desc">Mais recentes</option>
          <option value="date_asc">Mais antigos</option>
          <option value="amount_desc">Maior valor</option>
          <option value="amount_asc">Menor valor</option>
        </Select>
        {filtering && (
          <div className="flex items-end">
            <Button variant="ghost" onClick={clearFilters}>Limpar filtros</Button>
          </div>
        )}
        </div>
      </section>

      {error && (
        <div className="space-y-3">
          <Alert tone="error">{error}</Alert>
          <Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>Tentar novamente</Button>
        </div>
      )}

      {loading && rows.length === 0 && !error ? (
        <Loading />
      ) : !error && total === 0 && !loading ? (
        <div className="rounded-lg border border-line">
          {filtering ? (
            <EmptyState icon={Search} title="Nenhum resultado" description="Nenhum lançamento corresponde aos filtros escolhidos." action={<Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button>} />
          ) : (
            <EmptyState icon={Receipt} title="Nenhum lançamento ainda" description='Use a barra acima para registrar o primeiro, por exemplo "50 Uber".' />
          )}
        </div>
      ) : (
        !error && (
          <>
            <div className="overflow-x-auto" aria-busy={loading} tabIndex={0} role="region" aria-label="Lista de lançamentos">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th className="hidden sm:table-cell">Categoria</th>
                    <th className="text-right">Valor</th>
                    <th><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id}>
                      <td className="num whitespace-nowrap text-mute">
                        <span className="sm:hidden">{formatRelativeDate(t.occurred_on, todayISO())}</span>
                        <span className="hidden sm:inline">{formatDateBR(t.occurred_on)}</span>
                      </td>
                      <td>
                        <span className="block font-medium">{t.description}</span>
                        <span className="text-xs text-faint sm:hidden">{t.category_id ? (catName.get(t.category_id) ?? 'Sem categoria') : 'Sem categoria'}</span>
                      </td>
                      <td className="hidden text-mute sm:table-cell">{t.category_id ? (catName.get(t.category_id) ?? '—') : 'Sem categoria'}</td>
                      <td className="whitespace-nowrap text-right">
                        <Money cents={t.kind === 'income' ? t.amount_cents : -t.amount_cents} tone={t.kind} />
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <button type="button" onClick={() => setEditing(t)} aria-label={`Editar ${t.description}`} className="rounded-md p-2 text-mute hover:bg-surface2 hover:text-fg">
                          <Pencil size={16} />
                        </button>
                        <button type="button" onClick={() => { setDeleteError(null); setDeleting(t); }} aria-label={`Excluir ${t.description}`} className="rounded-md p-2 text-mute hover:bg-expense/10 hover:text-expense">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <nav aria-label="Paginação" className="flex items-center justify-between text-sm text-mute">
              <span className="num">Mostrando {startItem}–{endItem} de {total}</span>
              <span className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} aria-label="Página anterior">
                  <ChevronLeft size={16} />
                </Button>
                <span className="num">{page} / {pages}</span>
                <Button variant="secondary" size="sm" disabled={page >= pages || loading} onClick={() => setPage(page + 1)} aria-label="Próxima página">
                  <ChevronRight size={16} />
                </Button>
              </span>
            </nav>
          </>
        )
      )}

      <Modal open={editing !== null} title="Editar lançamento" onClose={() => setEditing(null)}>
        {editing && (
          <TransactionForm
            initial={{
              amountText: formatCentsForInput(editing.amount_cents),
              kind: editing.kind,
              description: editing.description,
              categoryId: editing.category_id ?? '',
              occurredOn: editing.occurred_on,
              paymentMethod: editing.payment_method ?? '',
            }}
            submitLabel="Salvar alterações"
            onCancel={() => setEditing(null)}
            onSubmit={async (input, values) => {
              try {
                await updateTransaction(editing.id, input);
                if (wsId && values.categoryId && values.categoryId !== (editing.category_id ?? '')) {
                  const keyword = ruleKeywordFromDescription(input.description);
                  if (keyword) await saveRule(wsId, keyword, values.categoryId).catch(() => undefined);
                }
                setEditing(null);
                bump();
                return null;
              } catch (e) {
                return mapDbError(e);
              }
            }}
          />
        )}
      </Modal>

      <Modal open={deleting !== null} title="Excluir lançamento?" onClose={() => setDeleting(null)}>
        {deleting && (
          <div className="space-y-4">
            {deleteError && <Alert tone="error">{deleteError}</Alert>}
            <p className="text-sm text-mute">
              <strong className="text-fg">{deleting.description}</strong> · {formatCentsToBRL(deleting.amount_cents)} · {formatDateBR(deleting.occurred_on)}
              <br />Essa ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancelar</Button>
              <Button variant="danger" loading={deleteBusy} onClick={() => void confirmDelete()}>Excluir</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
