import { useState, type FormEvent } from 'react';
import { Pause, Pencil, Play, Plus, Target, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Money } from '@/components/ui/Money';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PLANS } from '@/config/plans';
import { monthBounds, todayISO } from '@/domain/dates';
import { formatCentsForInput, formatCentsToBRL, parseMoneyToCents } from '@/domain/money';
import { budgetProgress } from '@/domain/progress';
import { useAsyncData } from '@/lib/useAsyncData';
import { mapDbError } from '@/services/dbErrors';
import { createBudget, deleteBudget, listBudgets, updateBudget } from '@/services/planningService';
import { getSummary } from '@/services/transactionService';
import type { Budget } from '@/types/db';
import { Loading } from '@/features/workspace/guards';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

export function BudgetsTab() {
  const { workspace, plan, categories, dataVersion } = useWorkspace();
  const wsId = workspace?.id ?? '';
  const { data, loading, error, reload } = useAsyncData(async () => {
    const { from, to } = monthBounds(todayISO());
    const [budgets, summary] = await Promise.all([listBudgets(wsId), getSummary(wsId, from, to)]);
    return { budgets, summary };
  }, [wsId, dataVersion]);

  const [editing, setEditing] = useState<Budget | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!workspace) return null;
  if (loading && !data) return <Loading />;
  if (error && !data) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  const spent = new Map(data.summary.categories.filter((c) => c.kind === 'expense' && c.category_id).map((c) => [c.category_id as string, c.total_cents]));
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Categoria removida';
  const limit = PLANS[plan].limits.maxActiveBudgets;
  const activeCount = data.budgets.filter((b) => b.active).length;
  const used = new Set(data.budgets.map((b) => b.category_id));
  const available = categories.filter((c) => c.kind === 'expense' && !used.has(c.id));

  async function toggle(b: Budget) {
    setActionError(null);
    try {
      await updateBudget(b.id, { active: !b.active });
      reload();
    } catch (e) {
      setActionError(mapDbError(e));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mute">
          Limite mensal por categoria de despesa, comparado com o que você já gastou neste mês.
          {limit !== null && <span className="num ml-1 text-faint">({activeCount} de {limit} ativos)</span>}
        </p>
        <Button onClick={() => setEditing('new')} disabled={available.length === 0}>
          <Plus size={16} aria-hidden="true" /> Novo orçamento
        </Button>
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      {data.budgets.length === 0 ? (
        <div className="rounded-lg border border-line">
          <EmptyState icon={Target} title="Nenhum orçamento ainda" description="Defina um limite mensal para uma categoria, como Alimentação, e acompanhe o quanto já foi usado." action={<Button onClick={() => setEditing('new')}>Criar orçamento</Button>} />
        </div>
      ) : (
        <ul className="divide-y divide-line/70 border-y border-line">
          {data.budgets.map((b) => {
            const s = spent.get(b.category_id) ?? 0;
            const p = budgetProgress(s, b.amount_cents);
            return (
              <li key={b.id} className={`py-4 ${b.active ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {nameOf(b.category_id)} {!b.active && <Badge>Pausado</Badge>}
                    </p>
                    <p className="num mt-0.5 text-sm text-mute">
                      <Money cents={s} className="text-fg" /> de <Money cents={b.amount_cents} className="text-mute" /> · {p.pct}%
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <button type="button" onClick={() => void toggle(b)} aria-label={b.active ? `Pausar orçamento de ${nameOf(b.category_id)}` : `Reativar orçamento de ${nameOf(b.category_id)}`} className="rounded-md p-2 text-mute hover:bg-surface2 hover:text-fg">
                      {b.active ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button type="button" onClick={() => setEditing(b)} aria-label={`Editar orçamento de ${nameOf(b.category_id)}`} className="rounded-md p-2 text-mute hover:bg-surface2 hover:text-fg">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => setDeleting(b)} aria-label={`Excluir orçamento de ${nameOf(b.category_id)}`} className="rounded-md p-2 text-mute hover:bg-expense/10 hover:text-expense">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <ProgressBar pct={p.pct} tone={p.state} label={`Uso do orçamento de ${nameOf(b.category_id)}`} className="mt-2.5" />
                <p className={`mt-1.5 text-xs ${p.state === 'over' ? 'text-expense' : 'text-faint'}`}>
                  {p.state === 'over' ? `Ultrapassou em ${formatCentsToBRL(-p.remainingCents)}` : `Restam ${formatCentsToBRL(p.remainingCents)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Novo orçamento' : 'Editar orçamento'} onClose={() => setEditing(null)}>
        {editing && (
          <BudgetForm
            wsId={wsId}
            budget={editing === 'new' ? null : editing}
            options={available.map((c) => ({ id: c.id, name: c.name }))}
            categoryName={editing === 'new' ? '' : nameOf(editing.category_id)}
            onDone={() => {
              setEditing(null);
              reload();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir orçamento?"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return null;
          try {
            await deleteBudget(deleting.id);
            reload();
            return null;
          } catch (e) {
            return mapDbError(e);
          }
        }}
      >
        O orçamento de <strong className="text-fg">{deleting ? nameOf(deleting.category_id) : ''}</strong> será removido. Seus lançamentos não são afetados.
      </ConfirmDialog>
    </div>
  );
}

interface BudgetFormProps {
  wsId: string;
  budget: Budget | null;
  options: { id: string; name: string }[];
  categoryName: string;
  onDone: () => void;
  onCancel: () => void;
}

function BudgetForm({ wsId, budget, options, categoryName, onDone, onCancel }: BudgetFormProps) {
  const [categoryId, setCategoryId] = useState(options[0]?.id ?? '');
  const [amount, setAmount] = useState(budget ? formatCentsForInput(budget.amount_cents) : '');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const cents = parseMoneyToCents(amount);
    if (cents === null || cents <= 0) {
      setAmountError('Informe um limite maior que zero, como 800,00.');
      return;
    }
    setAmountError(null);
    setSaving(true);
    setServerError(null);
    try {
      if (budget) await updateBudget(budget.id, { amount_cents: cents });
      else await createBudget(wsId, categoryId, cents);
      onDone();
    } catch (err) {
      setServerError(mapDbError(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError && <Alert tone="error">{serverError}</Alert>}
      {budget ? (
        <p className="text-sm text-mute">
          Categoria: <strong className="text-fg">{categoryName}</strong>
        </p>
      ) : (
        <Select label="Categoria de despesa" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      )}
      <Input label="Limite mensal (R$)" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} error={amountError ?? undefined} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
