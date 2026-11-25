import { addDays } from '@/domain/dates';
import type { ExistingTx, ReviewRow } from '@/domain/statement/types';
import { getSupabase } from '@/lib/supabase';
import { mapDbError } from '@/services/dbErrors';

export interface ImportResult {
  inserted: number;
  /** Já existiam (chave de idempotência repetida): ignoradas pela trava do banco. */
  duplicates: number;
  /** Recusadas pelo limite mensal do plano Free. */
  monthlyBlocked: number;
  /** Recusadas por estarem fora do histórico do plano Free. */
  historyBlocked: number;
  failed: number;
  firstError: string | null;
}

/** Lançamentos do período (com folga de 3 dias) para detectar duplicidades antes de importar. */
export async function fetchExistingForImport(workspaceId: string, minDate: string, maxDate: string): Promise<ExistingTx[]> {
  const from = addDays(minDate, -3);
  const to = addDays(maxDate, 3);
  const out: ExistingTx[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const { data, error } = await getSupabase()
      .from('transactions')
      .select('id, occurred_on, kind, amount_cents, idempotency_key')
      .eq('workspace_id', workspaceId)
      .gte('occurred_on', from)
      .lte('occurred_on', to)
      .order('id')
      .range(offset, offset + page - 1);
    if (error) throw error;
    const list = (data ?? []) as { id: string; occurred_on: string; kind: 'income' | 'expense'; amount_cents: number; idempotency_key: string | null }[];
    for (const r of list) {
      out.push({ id: r.id, date: r.occurred_on, kind: r.kind, cents: Number(r.amount_cents), key: r.idempotency_key });
    }
    if (list.length < page) break;
  }
  return out;
}

function toPayload(workspaceId: string, r: ReviewRow) {
  return {
    workspace_id: workspaceId,
    kind: r.kind,
    amount_cents: r.cents,
    description: r.description.replace(/\s+/g, ' ').trim().slice(0, 140).trim() || 'Sem descrição',
    category_id: r.categoryId,
    occurred_on: r.date,
    payment_method: r.paymentMethod,
    idempotency_key: r.key,
  };
}

type Reason = 'monthly' | 'history' | 'duplicate' | 'other';

function classify(error: unknown): Reason {
  const e = (error ?? {}) as { message?: string; code?: string };
  const msg = e.message ?? '';
  if (msg.includes('MONTHLY_LIMIT_REACHED')) return 'monthly';
  if (msg.includes('HISTORY_LIMIT')) return 'history';
  if (e.code === '23505') return 'duplicate';
  return 'other';
}

/**
 * Grava em lotes de 100. Se um lote falhar (limite do plano, duplicidade), regrava linha a linha para
 * salvar o que couber e contar o que foi recusado, em vez de perder tudo.
 */
export async function importTransactions(workspaceId: string, rows: ReviewRow[]): Promise<ImportResult> {
  const res: ImportResult = { inserted: 0, duplicates: 0, monthlyBlocked: 0, historyBlocked: 0, failed: 0, firstError: null };
  const blockedMonths = new Set<string>();
  let historyBlockedUpTo: string | null = null;
  let consecutiveOther = 0;
  const sb = getSupabase();

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await sb.from('transactions').insert(chunk.map((r) => toPayload(workspaceId, r)));
    if (!error) {
      res.inserted += chunk.length;
      consecutiveOther = 0;
      continue;
    }

    for (const row of chunk) {
      const month = row.date.slice(0, 7);
      if (blockedMonths.has(month)) {
        res.monthlyBlocked++;
        continue;
      }
      if (historyBlockedUpTo !== null && row.date <= historyBlockedUpTo) {
        res.historyBlocked++;
        continue;
      }
      if (consecutiveOther >= 5) {
        res.failed++;
        continue;
      }
      const { error: rowError } = await sb.from('transactions').insert(toPayload(workspaceId, row));
      if (!rowError) {
        res.inserted++;
        consecutiveOther = 0;
        continue;
      }
      const reason = classify(rowError);
      if (reason === 'monthly') {
        blockedMonths.add(month);
        res.monthlyBlocked++;
      } else if (reason === 'history') {
        historyBlockedUpTo = row.date;
        res.historyBlocked++;
      } else if (reason === 'duplicate') {
        res.duplicates++;
      } else {
        consecutiveOther++;
        res.failed++;
        res.firstError ??= mapDbError(rowError);
      }
    }
  }
  return res;
}
