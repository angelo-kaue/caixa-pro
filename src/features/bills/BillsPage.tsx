import { useState, type FormEvent } from 'react';
import { Check, FileText, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import { Navigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Money } from '@/components/ui/Money';
import type { Kind } from '@/domain/categorizer';
import { formatDateBR, isValidYMD, splitISO, todayISO } from '@/domain/dates';
import { formatCentsForInput, parseMoneyToCents } from '@/domain/money';
import { useAsyncData } from '@/lib/useAsyncData';
import { mapDbError } from '@/services/dbErrors';
import { createBill, deleteBill, getBillsOverview, listBills, reopenBill, settleBill, updateBill } from '@/services/planningService';
import type { Bill } from '@/types/db';
import { Loading } from '@/features/workspace/guards';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

const validDate = (v: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = splitISO(v);
  return isValidYMD(d.y, d.m, d.d);
};

export function BillsPage() {
  const { workspace, categories, dataVersion, bump } = useWorkspace();
  const wsId = workspace?.id ?? '';
  const [status, setStatus] = useState<'pending' | 'paid'>('pending');
  const [editing, setEditing] = useState<Bill | 'new' | null>(null);
  const [settling, setSettling] = useState<Bill | null>(null);
  const [deleting, setDeleting] = useState<Bill | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [bills, overview] = await Promise.all([listBills(wsId, status), getBillsOverview(wsId)]);
    return { bills, overview };
  }, [wsId, status, dataVersion]);

  if (!workspace) return null;
  if (workspace.type !== 'business') return <Navigate to="/app" replace />;
  if (loading && !data) return <Loading />;
  if (error && !data) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  const today = todayISO();
  const o = data.overview;
  const nameOf = (id: string | null) => (id ? (categories.find((c) => c.id === id)?.name ?? '') : '');

  async function undo(b: Bill) {
    setActionError(null);
    try {
      await reopenBill(b.id);
      bump();
      reload();
    } catch (e) {
      setActionError(mapDbError(e));
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1">Contas a pagar e a receber</h1>
          <p className="mt-1 text-sm text-mute">Compromissos com data de vencimento. Ao baixar uma conta, o CaixaPro cria o lançamento correspondente.</p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} aria-hidden="true" /> Nova conta
        </Button>
      </div>

      <dl className="grid grid-cols-1 divide-y divide-line border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="py-4 sm:pr-6">
          <dt className="text-sm text-mute">A pagar (pendente)</dt>
          <dd className="mt-1">
            <span className="text-xl"><Money cents={o.payable_cents} tone="expense" /></span>
            {o.overdue_payable_cents > 0 && <span className="mt-1 block text-xs text-warn">Em atraso: <Money cents={o.overdue_payable_cents} className="text-warn" /></span>}
          </dd>
        </div>
        <div className="py-4 sm:px-6">
          <dt className="text-sm text-mute">A receber (pendente)</dt>
          <dd className="mt-1">
            <span className="text-xl"><Money cents={o.receivable_cents} tone="income" /></span>
            {o.overdue_receivable_cents > 0 && <span className="mt-1 block text-xs text-warn">Em atraso: <Money cents={o.overdue_receivable_cents} className="text-warn" /></span>}
          </dd>
        </div>
        <div className="py-4 sm:pl-6">
          <dt className="text-sm text-mute">Saldo da diferença</dt>
          <dd className="mt-1">
            <span className="text-xl"><Money cents={o.receivable_cents - o.payable_cents} tone="auto" /></span>
            <span className="mt-1 block text-xs text-faint">A receber menos a pagar. Não considera o saldo atual.</span>
          </dd>
        </div>
      </dl>

      <div role="group" aria-label="Situação" className="inline-flex rounded-md border border-line p-0.5">
        {([['pending', 'Pendentes'], ['paid', 'Baixadas']] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)} className={clsx('rounded px-3 py-1.5 text-sm font-semibold transition-colors', status === id ? 'bg-surface2 text-fg' : 'text-mute hover:text-fg')}>
            {label}
          </button>
        ))}
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      {data.bills.length === 0 ? (
        <div className="rounded-lg border border-line">
          <EmptyState icon={FileText} title={status === 'pending' ? 'Nenhuma conta pendente' : 'Nenhuma conta baixada ainda'} description={status === 'pending' ? 'Cadastre o que você tem a pagar e a receber para acompanhar os vencimentos.' : 'As contas aparecem aqui depois de baixadas.'} action={status === 'pending' ? <Button onClick={() => setEditing('new')}>Cadastrar conta</Button> : undefined} />
        </div>
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Lista de contas">
          <table className="table-base">
            <thead>
              <tr>
                <th>{status === 'pending' ? 'Vencimento' : 'Baixa'}</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th className="text-right">Valor</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {data.bills.map((b) => {
                const overdue = b.status === 'pending' && b.due_on < today;
                return (
                  <tr key={b.id}>
                    <td className="num whitespace-nowrap">
                      <span className={overdue ? 'text-warn' : 'text-mute'}>{formatDateBR(status === 'pending' ? b.due_on : (b.paid_on ?? b.due_on))}</span>
                      {overdue && <span className="ml-2"><Badge tone="warn">Atrasada</Badge></span>}
                    </td>
                    <td>
                      <span className="block font-medium">{b.description}</span>
                      {b.category_id && <span className="text-xs text-faint">{nameOf(b.category_id)}</span>}
                    </td>
                    <td className="whitespace-nowrap text-mute">{b.kind === 'expense' ? 'A pagar' : 'A receber'}</td>
                    <td className="whitespace-nowrap text-right"><Money cents={b.amount_cents} tone={b.kind} /></td>
                    <td className="whitespace-nowrap text-right">
                      {b.status === 'pending' ? (
                        <>
                          <button type="button" onClick={() => setSettling(b)} aria-label={`${b.kind === 'expense' ? 'Marcar como paga' : 'Marcar como recebida'}: ${b.description}`} className="rounded-md p-2 text-mute hover:bg-brand-soft hover:text-brand"><Check size={16} /></button>
                          <button type="button" onClick={() => setEditing(b)} aria-label={`Editar ${b.description}`} className="rounded-md p-2 text-mute hover:bg-surface2 hover:text-fg"><Pencil size={16} /></button>
                        </>
                      ) : (
                        <button type="button" onClick={() => void undo(b)} aria-label={`Desfazer baixa de ${b.description}`} className="rounded-md p-2 text-mute hover:bg-surface2 hover:text-fg"><Undo2 size={16} /></button>
                      )}
                      <button type="button" onClick={() => setDeleting(b)} aria-label={`Excluir ${b.description}`} className="rounded-md p-2 text-mute hover:bg-expense/10 hover:text-expense"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data.bills.length >= 100 && <p className="text-xs text-faint">Mostrando as 100 primeiras contas.</p>}

      <Modal open={editing !== null} title={editing === 'new' ? 'Nova conta' : 'Editar conta'} onClose={() => setEditing(null)}>
        {editing && (
          <BillForm
            wsId={wsId}
            bill={editing === 'new' ? null : editing}
            onDone={() => {
              setEditing(null);
              reload();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal open={settling !== null} title={settling?.kind === 'expense' ? 'Marcar como paga' : 'Marcar como recebida'} onClose={() => setSettling(null)}>
        {settling && (
          <SettleForm
            bill={settling}
            onDone={() => {
              setSettling(null);
              bump();
              reload();
            }}
            onCancel={() => setSettling(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir conta?"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return null;
          try {
            await deleteBill(deleting.id);
            reload();
            return null;
          } catch (e) {
            return mapDbError(e);
          }
        }}
      >
        <strong className="text-fg">{deleting?.description}</strong> será removida da lista. {deleting?.status === 'paid' ? 'O lançamento criado na baixa continua no histórico.' : ''}
      </ConfirmDialog>
    </div>
  );
}

function BillForm({ wsId, bill, onDone, onCancel }: { wsId: string; bill: Bill | null; onDone: () => void; onCancel: () => void }) {
  const { categories } = useWorkspace();
  const [kind, setKind] = useState<Kind>(bill?.kind ?? 'expense');
  const [description, setDescription] = useState(bill?.description ?? '');
  const [amount, setAmount] = useState(bill ? formatCentsForInput(bill.amount_cents) : '');
  const [dueOn, setDueOn] = useState(bill?.due_on ?? todayISO());
  const [categoryId, setCategoryId] = useState(bill?.category_id ?? '');
  const [errors, setErrors] = useState<Partial<Record<'description' | 'amount' | 'due', string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const options = categories.filter((c) => c.kind === kind);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const errs: typeof errors = {};
    const desc = description.trim();
    if (desc.length < 1 || desc.length > 140) errs.description = 'Informe uma descrição de até 140 caracteres.';
    const cents = parseMoneyToCents(amount);
    if (cents === null || cents <= 0) errs.amount = 'Informe um valor maior que zero.';
    if (!validDate(dueOn)) errs.due = 'Informe uma data válida.';
    setErrors(errs);
    if (Object.keys(errs).length > 0 || cents === null) return;

    setSaving(true);
    setServerError(null);
    const input = { kind, description: desc, amountCents: cents, dueOn, categoryId: categoryId || null };
    try {
      if (bill) await updateBill(bill.id, input);
      else await createBill(wsId, input);
      onDone();
    } catch (err) {
      setServerError(mapDbError(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError && <Alert tone="error">{serverError}</Alert>}
      {bill ? (
        <p className="text-sm text-mute">Tipo: <strong className="text-fg">{bill.kind === 'expense' ? 'A pagar' : 'A receber'}</strong></p>
      ) : (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Tipo</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['expense', 'income'] as const).map((k) => (
              <label key={k} className={clsx('flex h-10 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand', kind === k ? (k === 'income' ? 'border-income bg-income/10 text-income' : 'border-expense bg-expense/10 text-expense') : 'border-line text-mute hover:border-line2')}>
                <input type="radio" name="bill-kind" checked={kind === k} onChange={() => { setKind(k); setCategoryId(''); }} className="sr-only" />
                {k === 'income' ? 'A receber' : 'A pagar'}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Input label="Descrição" maxLength={140} value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Valor (R$)" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
        <Input label="Vencimento" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} error={errors.due} />
      </div>
      <Select label="Categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <option value="">Sem categoria</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={saving}>Salvar</Button>
      </div>
    </form>
  );
}

function SettleForm({ bill, onDone, onCancel }: { bill: Bill; onDone: () => void; onCancel: () => void }) {
  const [paidOn, setPaidOn] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!validDate(paidOn)) {
      setError('Informe uma data válida.');
      return;
    }
    setError(null);
    setSaving(true);
    setServerError(null);
    try {
      await settleBill(bill.id, paidOn);
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
        <strong className="text-fg">{bill.description}</strong> · <Money cents={bill.amount_cents} tone={bill.kind} />. Será criado um lançamento de {bill.kind === 'expense' ? 'despesa' : 'receita'} na data abaixo.
      </p>
      <Input label={bill.kind === 'expense' ? 'Data do pagamento' : 'Data do recebimento'} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} error={error ?? undefined} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={saving}>Confirmar baixa</Button>
      </div>
    </form>
  );
}
