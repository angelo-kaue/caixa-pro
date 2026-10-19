import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CornerDownLeft, SlidersHorizontal } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ruleKeywordFromDescription } from '@/domain/categorizer';
import { formatDateBR, todayISO } from '@/domain/dates';
import { formatCentsForInput, formatCentsToBRL } from '@/domain/money';
import { parseQuickEntry, type ParsedEntry } from '@/domain/parser';
import { newUuid } from '@/lib/uuid';
import { mapDbError } from '@/services/dbErrors';
import { createTransaction, deleteTransaction, hasSimilarTransaction, type TxInput } from '@/services/transactionService';
import { saveRule } from '@/services/workspaceService';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { Modal } from '@/components/ui/Modal';
import { PAYMENT_LABELS, TransactionForm, type FormValues } from './TransactionForm';

interface Draft {
  values: FormValues;
  notices: string[];
  /** Categoria sugerida pelo sistema: se o usuário mudar, guardamos a preferência. */
  suggestedCategoryId: string;
  title: string;
}

const EXAMPLES = ['50 Uber', 'Mercado 186,40', 'Recebi 2500 de salário'];

const emptyValues = (): FormValues => ({
  amountText: '',
  kind: 'expense',
  description: '',
  categoryId: '',
  occurredOn: todayISO(),
  paymentMethod: '',
});

export function QuickEntry() {
  const { workspace, userRules, usage, findCategory, bump } = useWorkspace();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string; undoId?: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  // Chave de idempotência da tentativa atual: impede gravar duas vezes em cliques repetidos ou reenvios.
  const keyRef = useRef(newUuid());

  const parsed: ParsedEntry | null = useMemo(
    () => (text.trim() ? parseQuickEntry(text, { today: todayISO(), userRules }) : null),
    [text, userRules],
  );

  // A confirmação some sozinha (com tempo para desfazer); erros ficam até a próxima ação.
  useEffect(() => {
    if (!message || message.tone === 'error') return;
    const t = window.setTimeout(() => setMessage(null), message.undoId ? 8000 : 4000);
    return () => window.clearTimeout(t);
  }, [message]);

  if (!workspace) return null;
  const ws = workspace;

  function toDraft(p: ParsedEntry, extraNotices: string[] = []): Draft {
    const category = findCategory(p.kind, p.categoryName);
    const notices = [...p.reasons, ...extraNotices];
    if (p.categoryName && !category && !notices.includes('Escolha uma categoria.')) {
      notices.push('Escolha uma categoria.');
    }
    return {
      values: {
        amountText: p.amountCents ? formatCentsForInput(p.amountCents) : '',
        kind: p.kind,
        description: p.description,
        categoryId: category?.id ?? '',
        occurredOn: p.occurredOn,
        paymentMethod: p.paymentMethod ?? '',
      },
      notices,
      suggestedCategoryId: category?.id ?? '',
      title: 'Confirmar lançamento',
    };
  }

  async function persist(input: TxInput, learn: { suggestedCategoryId: string } | null): Promise<string | null> {
    try {
      const newId = await createTransaction(ws.id, input, keyRef.current);
      if (input.categoryId && learn && input.categoryId !== learn.suggestedCategoryId) {
        const keyword = ruleKeywordFromDescription(input.description);
        if (keyword) await saveRule(ws.id, keyword, input.categoryId).catch(() => undefined);
      }
      keyRef.current = newUuid();
      bump();
      setMessage({
        tone: 'success',
        undoId: newId,
        text: `Registrado: ${input.description} · ${formatCentsToBRL(input.amountCents)} · ${input.kind === 'income' ? 'Receita' : 'Despesa'}`,
      });
      setText('');
      return null;
    } catch (e) {
      return mapDbError(e);
    }
  }

  async function undo(id: string) {
    try {
      await deleteTransaction(id);
      bump();
      setMessage({ tone: 'success', text: 'Lançamento desfeito.' });
    } catch (e) {
      setMessage({ tone: 'error', text: mapDbError(e) });
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving || !parsed) return;
    setMessage(null);

    if (parsed.amountCents === null) {
      setMessage({ tone: 'error', text: 'Não encontrei o valor. Tente algo como "50 Uber" ou "Recebi 2500 de salário".' });
      return;
    }

    const d = toDraft(parsed);
    if (parsed.needsConfirmation || d.notices.length > 0) {
      setDraft(d);
      return;
    }

    const input: TxInput = {
      kind: parsed.kind,
      amountCents: parsed.amountCents,
      description: parsed.description,
      categoryId: d.values.categoryId || null,
      occurredOn: parsed.occurredOn,
      paymentMethod: parsed.paymentMethod,
    };

    setSaving(true);
    try {
      if (await hasSimilarTransaction(ws.id, input)) {
        setDraft(toDraft(parsed, ['Já existe um lançamento idêntico (mesmo tipo, valor, data e descrição). Confirme se quer registrar de novo.']));
        return;
      }
      const err = await persist(input, { suggestedCategoryId: d.suggestedCategoryId });
      if (err) setMessage({ tone: 'error', text: err });
    } catch (e2) {
      setMessage({ tone: 'error', text: mapDbError(e2) });
    } finally {
      setSaving(false);
    }
  }

  const categoryName = parsed ? (findCategory(parsed.kind, parsed.categoryName)?.name ?? null) : null;

  return (
    <section aria-label="Lançamento rápido" className="border-b border-line pb-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="quick-entry" className="sr-only">
            Lançamento rápido
          </label>
          <input
            id="quick-entry"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            autoComplete="off"
            placeholder='Ex.: "50 Uber" ou "Recebi 2500"'
            className="h-12 w-full rounded-md border border-line bg-canvas2 px-4 pr-10 text-[0.95rem] placeholder:text-faint focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <CornerDownLeft size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="lg" loading={saving} className="flex-1 sm:flex-none">
            Registrar
          </Button>
          <Button
            variant="secondary"
            size="lg"
            aria-label="Preencher detalhes manualmente"
            onClick={() => setDraft({ values: emptyValues(), notices: [], suggestedCategoryId: '', title: 'Novo lançamento' })}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Detalhado</span>
          </Button>
        </div>
      </form>

      <div className="mt-2.5 min-h-[1.5rem] text-sm" aria-live="polite">
        {parsed ? (
          parsed.amountCents === null ? (
            <span className="text-faint">Inclua o valor, por exemplo: {parsed.description || 'Uber'} 50</span>
          ) : (
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-mute">
              <span>
                Valor <strong className="num text-fg">{formatCentsToBRL(parsed.amountCents)}</strong>
              </span>
              <span className={parsed.kind === 'income' ? 'text-income' : 'text-expense'}>{parsed.kind === 'income' ? 'Receita' : 'Despesa'}</span>
              <span>
                Categoria <strong className="text-fg">{categoryName ?? 'a escolher'}</strong>
              </span>
              {parsed.occurredOn !== todayISO() && <span>Data {formatDateBR(parsed.occurredOn)}</span>}
              {parsed.paymentMethod && <span>{PAYMENT_LABELS[parsed.paymentMethod]}</span>}
              {parsed.needsConfirmation && <span className="text-warn">Vou pedir sua confirmação</span>}
            </span>
          )
        ) : (
          usage?.count === 0 ? (
            <span className="flex flex-wrap items-center gap-2 text-faint">
              <span>Experimente:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setText(ex);
                    inputRef.current?.focus();
                  }}
                  className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-mute transition-colors hover:border-line2 hover:text-fg"
                >
                  {ex}
                </button>
              ))}
            </span>
          ) : (
            usage?.limit != null && (
              <span className="text-faint">
                {usage.count} de {usage.limit} lançamentos usados neste mês
              </span>
            )
          )
        )}
      </div>

      {message && (
        <Alert tone={message.tone}>
          {message.text}
          {message.undoId && (
            <button type="button" onClick={() => void undo(message.undoId as string)} className="ml-3 font-semibold underline underline-offset-2">
              Desfazer
            </button>
          )}
        </Alert>
      )}

      <Modal open={draft !== null} title={draft?.title ?? ''} onClose={() => setDraft(null)}>
        {draft && (
          <TransactionForm
            initial={draft.values}
            notices={draft.notices}
            submitLabel="Confirmar e salvar"
            onCancel={() => setDraft(null)}
            onSubmit={async (input) => {
              const err = await persist(input, { suggestedCategoryId: draft.suggestedCategoryId });
              if (!err) setDraft(null);
              return err;
            }}
          />
        )}
      </Modal>
    </section>
  );
}
