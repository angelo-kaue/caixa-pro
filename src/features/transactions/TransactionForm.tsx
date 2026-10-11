import { useMemo, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import type { Kind } from '@/domain/categorizer';
import { isValidYMD, splitISO } from '@/domain/dates';
import { parseMoneyToCents } from '@/domain/money';
import type { PaymentMethod } from '@/domain/parser';
import type { TxInput } from '@/services/transactionService';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';

export interface FormValues {
  amountText: string;
  kind: Kind;
  description: string;
  categoryId: string;
  occurredOn: string;
  paymentMethod: PaymentMethod | '';
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  cash: 'Dinheiro',
  bank_slip: 'Boleto',
  transfer: 'Transferência',
  other: 'Outro',
};

interface Props {
  initial: FormValues;
  submitLabel: string;
  /** Avisos exibidos acima do formulário (ex.: motivos da confirmação). */
  notices?: string[];
  /** Retorna uma mensagem de erro, ou null em caso de sucesso. */
  onSubmit: (input: TxInput, values: FormValues) => Promise<string | null>;
  onCancel: () => void;
}

type FieldErrors = Partial<Record<'amount' | 'description' | 'date', string>>;

export function TransactionForm({ initial, submitLabel, notices = [], onSubmit, onCancel }: Props) {
  const { categories } = useWorkspace();
  const [v, setV] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const options = useMemo(() => categories.filter((c) => c.kind === v.kind), [categories, v.kind]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setV((prev) => ({ ...prev, [key]: value }));

  const setKind = (kind: Kind) =>
    setV((prev) => ({
      ...prev,
      kind,
      categoryId: categories.some((c) => c.id === prev.categoryId && c.kind === kind) ? prev.categoryId : '',
    }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    const next: FieldErrors = {};
    const amountCents = parseMoneyToCents(v.amountText);
    if (amountCents === null || amountCents <= 0) next.amount = 'Informe um valor maior que zero, como 50,00.';
    const description = v.description.trim();
    if (description.length < 1 || description.length > 140) next.description = 'Informe uma descrição de até 140 caracteres.';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v.occurredOn) ? splitISO(v.occurredOn) : null;
    if (!d || !isValidYMD(d.y, d.m, d.d)) next.date = 'Informe uma data válida.';
    setErrors(next);
    if (Object.keys(next).length > 0 || amountCents === null) return;

    setSaving(true);
    setServerError(null);
    const input: TxInput = {
      kind: v.kind,
      amountCents,
      description,
      categoryId: v.categoryId || null,
      occurredOn: v.occurredOn,
      paymentMethod: v.paymentMethod || null,
    };
    const err = await onSubmit(input, v);
    setSaving(false);
    if (err) setServerError(err);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {notices.length > 0 && (
        <Alert tone="info">
          <p className="font-semibold text-fg">Confira antes de salvar</p>
          <ul className="mt-1 list-disc pl-5">
            {notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Alert>
      )}
      {serverError && <Alert tone="error">{serverError}</Alert>}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Tipo</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['expense', 'income'] as const).map((k) => (
            <label
              key={k}
              className={clsx(
                'flex h-10 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand',
                v.kind === k
                  ? k === 'income'
                    ? 'border-income bg-income/10 text-income'
                    : 'border-expense bg-expense/10 text-expense'
                  : 'border-line text-mute hover:border-line2',
              )}
            >
              <input type="radio" name="kind" value={k} checked={v.kind === k} onChange={() => setKind(k)} className="sr-only" />
              {k === 'income' ? 'Receita' : 'Despesa'}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Valor (R$)" inputMode="decimal" placeholder="0,00" value={v.amountText} onChange={(e) => set('amountText', e.target.value)} error={errors.amount} />
        <Input label="Data" type="date" value={v.occurredOn} onChange={(e) => set('occurredOn', e.target.value)} error={errors.date} />
      </div>
      <Input label="Descrição" maxLength={140} value={v.description} onChange={(e) => set('description', e.target.value)} error={errors.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Categoria" value={v.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
          <option value="">Sem categoria</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Forma de pagamento (opcional)" value={v.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value as PaymentMethod | '')}>
          <option value="">Não informar</option>
          {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
