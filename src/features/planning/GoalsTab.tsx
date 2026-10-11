import { useState, type FormEvent } from 'react';
import { Flag, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Money } from '@/components/ui/Money';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { UpgradeNotice } from '@/components/ui/UpgradeNotice';
import { hasFeature } from '@/config/plans';
import { formatDateBR, isValidYMD, splitISO, todayISO } from '@/domain/dates';
import { MAX_AMOUNT_CENTS, formatCentsForInput, formatCentsToBRL, parseMoneyToCents } from '@/domain/money';
import { goalProgress } from '@/domain/progress';
import { useAsyncData } from '@/lib/useAsyncData';
import { mapDbError } from '@/services/dbErrors';
import { createGoal, deleteGoal, listGoals, updateGoal } from '@/services/planningService';
import type { Goal } from '@/types/db';
import { Loading } from '@/features/workspace/guards';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

export function GoalsTab() {
  const { workspace, plan } = useWorkspace();
  const wsId = workspace?.id ?? '';
  const canCreate = hasFeature(plan, 'goals');
  const { data, loading, error, reload } = useAsyncData(() => listGoals(wsId), [wsId]);
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);

  if (!workspace) return null;
  if (loading && !data) return <Loading />;
  if (error && !data) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  const today = todayISO();

  if (!canCreate && data.length === 0) {
    return <UpgradeNotice title="Metas financeiras fazem parte do plano Pro" description="Defina quanto quer juntar, acompanhe o progresso e veja quanto guardar por mês até a data que escolher." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mute">Valores que você quer juntar, com o progresso de cada um.</p>
        {canCreate && (
          <Button onClick={() => setEditing('new')}>
            <Plus size={16} aria-hidden="true" /> Nova meta
          </Button>
        )}
      </div>
      {!canCreate && <Alert tone="info">Suas metas continuam salvas e editáveis, mas criar novas metas faz parte do plano Pro.</Alert>}

      {data.length === 0 ? (
        <div className="rounded-lg border border-line">
          <EmptyState icon={Flag} title="Nenhuma meta ainda" description="Crie uma meta, como uma reserva de emergência ou uma viagem, e registre os valores que for guardando." action={<Button onClick={() => setEditing('new')}>Criar meta</Button>} />
        </div>
      ) : (
        <ul className="divide-y divide-line/70 border-y border-line">
          {data.map((g) => {
            const p = goalProgress(g.current_cents, g.target_cents, g.target_date, today);
            return (
              <li key={g.id} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {g.name} {p.completed && <Badge tone="income">Concluída</Badge>}
                    </p>
                    <p className="num mt-0.5 text-sm text-mute">
                      <Money cents={g.current_cents} className="text-fg" /> de <Money cents={g.target_cents} className="text-mute" /> · {p.pct}%
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <button type="button" onClick={() => setContributing(g)} aria-label={`Registrar valor na meta ${g.name}`} className="rounded-md p-2 text-mute hover:bg-surface2 hover:text-brand">
                      <PiggyBank size={16} />
                    </button>
                    <button type="button" onClick={() => setEditing(g)} aria-label={`Editar meta ${g.name}`} className="rounded-md p-2 text-mute hover:bg-surface2 hover:text-fg">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => setDeleting(g)} aria-label={`Excluir meta ${g.name}`} className="rounded-md p-2 text-mute hover:bg-expense/10 hover:text-expense">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <ProgressBar pct={p.pct} label={`Progresso da meta ${g.name}`} className="mt-2.5" />
                <p className={`mt-1.5 text-xs ${p.overdue ? 'text-warn' : 'text-faint'}`}>
                  {p.completed
                    ? 'Meta atingida.'
                    : p.overdue
                      ? `A data-alvo (${formatDateBR(g.target_date ?? today)}) passou. Faltam ${formatCentsToBRL(p.remainingCents)}.`
                      : p.perMonthCents !== null
                        ? `Faltam ${formatCentsToBRL(p.remainingCents)}. Guardando ${formatCentsToBRL(p.perMonthCents)} por mês você chega em ${formatDateBR(g.target_date ?? today)}.`
                        : `Faltam ${formatCentsToBRL(p.remainingCents)}.`}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Nova meta' : 'Editar meta'} onClose={() => setEditing(null)}>
        {editing && (
          <GoalForm
            wsId={wsId}
            goal={editing === 'new' ? null : editing}
            onDone={() => {
              setEditing(null);
              reload();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal open={contributing !== null} title={contributing ? `Valor na meta: ${contributing.name}` : ''} onClose={() => setContributing(null)}>
        {contributing && (
          <ContributionForm
            goal={contributing}
            onDone={() => {
              setContributing(null);
              reload();
            }}
            onCancel={() => setContributing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir meta?"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return null;
          try {
            await deleteGoal(deleting.id);
            reload();
            return null;
          } catch (e) {
            return mapDbError(e);
          }
        }}
      >
        A meta <strong className="text-fg">{deleting?.name}</strong> será removida. Seus lançamentos não são afetados.
      </ConfirmDialog>
    </div>
  );
}

function GoalForm({ wsId, goal, onDone, onCancel }: { wsId: string; goal: Goal | null; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? formatCentsForInput(goal.target_cents) : '');
  const [date, setDate] = useState(goal?.target_date ?? '');
  const [errors, setErrors] = useState<{ name?: string; target?: string; date?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const errs: typeof errors = {};
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 80) errs.name = 'Informe um nome de até 80 caracteres.';
    const cents = parseMoneyToCents(target);
    if (cents === null || cents <= 0) errs.target = 'Informe um valor maior que zero, como 5.000,00.';
    if (date) {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? splitISO(date) : null;
      if (!d || !isValidYMD(d.y, d.m, d.d)) errs.date = 'Informe uma data válida.';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0 || cents === null) return;

    setSaving(true);
    setServerError(null);
    try {
      if (goal) await updateGoal(goal.id, { name: trimmed, target_cents: cents, target_date: date || null });
      else await createGoal(wsId, { name: trimmed, targetCents: cents, targetDate: date || null });
      onDone();
    } catch (err) {
      setServerError(mapDbError(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError && <Alert tone="error">{serverError}</Alert>}
      <Input label="Nome da meta" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Valor da meta (R$)" inputMode="decimal" placeholder="0,00" value={target} onChange={(e) => setTarget(e.target.value)} error={errors.target} />
        <Input label="Data-alvo (opcional)" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
      </div>
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

function ContributionForm({ goal, onDone, onCancel }: { goal: Goal; onDone: () => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const cents = parseMoneyToCents(amount);
    if (cents === null || cents <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    const next = mode === 'add' ? goal.current_cents + cents : goal.current_cents - cents;
    if (next < 0) {
      setError(`Você só pode retirar até ${formatCentsToBRL(goal.current_cents)}.`);
      return;
    }
    if (next > MAX_AMOUNT_CENTS) {
      setError('O valor total ficaria acima do limite permitido.');
      return;
    }
    setError(null);
    setSaving(true);
    setServerError(null);
    try {
      await updateGoal(goal.id, { current_cents: next });
      onDone();
    } catch (err) {
      setServerError(mapDbError(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError && <Alert tone="error">{serverError}</Alert>}
      <p className="text-sm text-mute">
        Guardado até agora: <strong className="num text-fg">{formatCentsToBRL(goal.current_cents)}</strong>. Este valor é só um registro na meta e não move dinheiro nem cria lançamento.
      </p>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Operação</legend>
        {(['add', 'remove'] as const).map((m) => (
          <label key={m} className={`flex h-10 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${mode === m ? 'border-brand bg-brand-soft text-brand' : 'border-line text-mute hover:border-line2'}`}>
            <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
            {m === 'add' ? 'Adicionar' : 'Retirar'}
          </label>
        ))}
      </fieldset>
      <Input label="Valor (R$)" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} error={error ?? undefined} />
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
