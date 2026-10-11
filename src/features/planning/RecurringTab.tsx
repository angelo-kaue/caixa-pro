import { useState, type FormEvent } from 'react';
import { CalendarClock, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Money } from '@/components/ui/Money';
import { UpgradeNotice } from '@/components/ui/UpgradeNotice';
import { hasFeature } from '@/config/plans';
import type { Kind } from '@/domain/categorizer';
import { formatDateBR, isValidYMD, splitISO, todayISO } from '@/domain/dates';
import { formatCentsForInput, parseMoneyToCents } from '@/domain/money';
import type { PaymentMethod } from '@/domain/parser';
import { useAsyncData } from '@/lib/useAsyncData';
import { mapDbError } from '@/services/dbErrors';
import { createRule, deleteRule, generateRecurring, listRules, setRuleActive, updateRule, type RuleInput } from '@/services/planningService';
import type { RecurringRule } from '@/types/db';
import { PAYMENT_LABELS } from '@/features/transactions/TransactionForm';
import { Loading } from '@/features/workspace/guards';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

const validDate = (v: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = splitISO(v);
  return isValidYMD(d.y, d.m, d.d);
};

export function RecurringTab() {
  const { workspace, plan, categories, bump } = useWorkspace();
  const wsId = workspace?.id ?? '';
  const canCreate = hasFeature(plan, 'recurring');
  const { data, loading, error, reload } = useAsyncData(() => listRules(wsId), [wsId]);
  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null);
  const [deleting, setDeleting] = useState<RecurringRule | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!workspace) return null;
  if (loading && !data) return <Loading />;
  if (error && !data) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  if (!canCreate && data.length === 0) {
    return <UpgradeNotice title="Despesas e receitas recorrentes fazem parte do plano Pro" description="Cadastre aluguel, assinaturas, salário e outros valores fixos. O CaixaPro cria os lançamentos todo mês, sem você precisar digitar." />;
  }

  const nameOf = (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? '') : 'Sem categoria');

  async function toggle(r: RecurringRule) {
    setActionError(null);
    try {
      await setRuleActive(r.id, !r.active);
      if (!r.active) {
        await generateRecurring(wsId);
        bump();
      }
      reload();
    } catch (e) {
      setActionError(mapDbError(e));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-mute">Os lançamentos são criados automaticamente, até hoje, quando você abre o CaixaPro. Se você apagar um lançamento gerado, ele não volta.</p>
        {canCreate && (
          <Button onClick={() => setEditing('new')}>
            <Plus size={16} aria-hidden="true" /> Nova recorrência
          </Button>
        )}
      </div>
      {!canCreate && <Alert tone="info">Suas recorrências continuam salvas, mas a geração automática e a criação de novas fazem parte do plano Pro.</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}

      {data.length === 0 ? (
        <div className="rounded-lg border border-line">
          <EmptyState icon={CalendarClock} title="Nenhuma recorrência ainda" description="Cadastre o que se repete todo mês, como aluguel ou assinaturas." action={<Button onClick={() => setEditing('new')}>Criar recorrência</Button>} />
        </div>
      ) : (
        <ul className="divide-y divide-line/70 border-y border-line">
          {data.map((r) => (
            <li key={r.id} className={clsx('flex items-start justify-between gap-3 py-4', !r.active && 'opacity-60')}>
              <div className="min-w-0">
                <p className="font-medium">
                  {r.description} {!r.active && <Badge>Pausada</Badge>}
                </p>
                <p className="mt-0.5 text-sm text-mute">
                  <Money cents={r.amount_cents} tone={r.kind} /> · todo dia {r.day_of_month} · {nameOf(r.category_id)}
                </p>
                <p className="mt-0.5 text-xs text-faint">
                  Desde {formatDateBR(r.start_on)}
                  {r.end_on ? ` até ${formatDateBR(r.end_on)}` : ', sem data final'}
                </p>
              </div>
              <div className="flex shrink-0">
                <button type="button" onClick={() => void toggle(r)} aria-label={r.active ? `Pausar ${r.description}` : `Reativar ${r.description}`} className="rounded-md p-2 text-mute hover:bg-surface2 hover:text-fg">
                  {r.active ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button type="button" onClick={() => setEditing(r)} aria-label={`Editar ${r.description}`} className="rounded-md p-2 text-mute hover:bg-surface2 hover:text-fg">
                  <Pencil size={16} />
                </button>
                <button type="button" onClick={() => setDeleting(r)} aria-label={`Excluir ${r.description}`} className="rounded-md p-2 text-mute hover:bg-expense/10 hover:text-expense">
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Nova recorrência' : 'Editar recorrência'} onClose={() => setEditing(null)}>
        {editing && (
          <RuleForm
            wsId={wsId}
            rule={editing === 'new' ? null : editing}
            onDone={async () => {
              setEditing(null);
              try {
                await generateRecurring(wsId);
                bump();
              } catch {
                /* a geração será tentada de novo ao abrir o app */
              }
              reload();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir recorrência?"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return null;
          try {
            await deleteRule(deleting.id);
            reload();
            return null;
          } catch (e) {
            return mapDbError(e);
          }
        }}
      >
        <strong className="text-fg">{deleting?.description}</strong> deixará de ser gerada. Os lançamentos que já foram criados continuam no histórico.
      </ConfirmDialog>
    </div>
  );
}

function RuleForm({ wsId, rule, onDone, onCancel }: { wsId: string; rule: RecurringRule | null; onDone: () => void | Promise<void>; onCancel: () => void }) {
  const { categories } = useWorkspace();
  const [kind, setKind] = useState<Kind>(rule?.kind ?? 'expense');
  const [amount, setAmount] = useState(rule ? formatCentsForInput(rule.amount_cents) : '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [categoryId, setCategoryId] = useState(rule?.category_id ?? '');
  const [payment, setPayment] = useState<PaymentMethod | ''>(rule?.payment_method ?? '');
  const [day, setDay] = useState(String(rule?.day_of_month ?? new Date().getDate()));
  const [startOn, setStartOn] = useState(rule?.start_on ?? todayISO());
  const [endOn, setEndOn] = useState(rule?.end_on ?? '');
  const [errors, setErrors] = useState<Partial<Record<'amount' | 'description' | 'day' | 'start' | 'end', string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const options = categories.filter((c) => c.kind === kind);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const errs: typeof errors = {};
    const cents = parseMoneyToCents(amount);
    if (cents === null || cents <= 0) errs.amount = 'Informe um valor maior que zero.';
    const desc = description.trim();
    if (desc.length < 1 || desc.length > 140) errs.description = 'Informe uma descrição de até 140 caracteres.';
    const dayNum = Number(day);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) errs.day = 'Informe um dia de 1 a 31.';
    if (!validDate(startOn)) errs.start = 'Informe uma data válida.';
    if (endOn && !validDate(endOn)) errs.end = 'Informe uma data válida.';
    else if (endOn && validDate(startOn) && endOn < startOn) errs.end = 'A data final deve ser depois da inicial.';
    setErrors(errs);
    if (Object.keys(errs).length > 0 || cents === null) return;

    const input: RuleInput = {
      kind,
      amountCents: cents,
      description: desc,
      categoryId: categoryId || null,
      paymentMethod: payment || null,
      dayOfMonth: dayNum,
      startOn,
      endOn: endOn || null,
    };
    setSaving(true);
    setServerError(null);
    try {
      if (rule) await updateRule(rule.id, input);
      else await createRule(wsId, input);
      await onDone();
    } catch (err) {
      setServerError(mapDbError(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError && <Alert tone="error">{serverError}</Alert>}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Tipo</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['expense', 'income'] as const).map((k) => (
            <label key={k} className={clsx('flex h-10 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand', kind === k ? (k === 'income' ? 'border-income bg-income/10 text-income' : 'border-expense bg-expense/10 text-expense') : 'border-line text-mute hover:border-line2')}>
              <input
                type="radio"
                name="rule-kind"
                checked={kind === k}
                onChange={() => {
                  setKind(k);
                  setCategoryId('');
                }}
                className="sr-only"
              />
              {k === 'income' ? 'Receita' : 'Despesa'}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Valor (R$)" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
        <Input label="Dia do mês" type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} error={errors.day} hint="Em meses mais curtos, vale o último dia." />
      </div>
      <Input label="Descrição" maxLength={140} value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Sem categoria</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Forma de pagamento (opcional)" value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod | '')}>
          <option value="">Não informar</option>
          {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Começa em" type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} error={errors.start} />
        <Input label="Termina em (opcional)" type="date" value={endOn} onChange={(e) => setEndOn(e.target.value)} error={errors.end} />
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
