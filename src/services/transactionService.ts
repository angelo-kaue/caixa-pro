import type { Kind } from '@/domain/categorizer';
import type { PaymentMethod } from '@/domain/parser';
import { getSupabase } from '@/lib/supabase';
import type { Summary, Transaction } from '@/types/db';

const COLUMNS = 'id, workspace_id, kind, amount_cents, description, category_id, occurred_on, payment_method, created_at';

export type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export interface TxFilters {
  search: string;
  from: string | null;
  to: string | null;
  categoryId: string | null;
  kind: Kind | null;
  sort: SortKey;
  page: number;
  pageSize: number;
}

export interface TxInput {
  kind: Kind;
  amountCents: number;
  description: string;
  categoryId: string | null;
  occurredOn: string;
  paymentMethod: PaymentMethod | null;
}

/** Escapa curingas do ILIKE para a busca ser literal. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listTransactions(workspaceId: string, f: TxFilters): Promise<{ rows: Transaction[]; total: number }> {
  let q = getSupabase().from('transactions').select(COLUMNS, { count: 'exact' }).eq('workspace_id', workspaceId);

  const search = f.search.trim();
  if (search) q = q.ilike('description', `%${escapeLike(search)}%`);
  if (f.from) q = q.gte('occurred_on', f.from);
  if (f.to) q = q.lte('occurred_on', f.to);
  if (f.categoryId) q = q.eq('category_id', f.categoryId);
  if (f.kind) q = q.eq('kind', f.kind);

  switch (f.sort) {
    case 'date_asc':
      q = q.order('occurred_on', { ascending: true }).order('created_at', { ascending: true });
      break;
    case 'amount_desc':
      q = q.order('amount_cents', { ascending: false }).order('occurred_on', { ascending: false });
      break;
    case 'amount_asc':
      q = q.order('amount_cents', { ascending: true }).order('occurred_on', { ascending: false });
      break;
    default:
      q = q.order('occurred_on', { ascending: false }).order('created_at', { ascending: false });
  }

  const start = (f.page - 1) * f.pageSize;
  const { data, error, count } = await q.range(start, start + f.pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as Transaction[], total: count ?? 0 };
}

export async function createTransaction(workspaceId: string, input: TxInput, idempotencyKey: string): Promise<void> {
  const { error } = await getSupabase().from('transactions').insert({
    workspace_id: workspaceId,
    kind: input.kind,
    amount_cents: input.amountCents,
    description: input.description,
    category_id: input.categoryId,
    occurred_on: input.occurredOn,
    payment_method: input.paymentMethod,
    idempotency_key: idempotencyKey,
  });
  if (error) throw error;
}

export async function updateTransaction(id: string, input: TxInput): Promise<void> {
  const { data, error } = await getSupabase()
    .from('transactions')
    .update({
      kind: input.kind,
      amount_cents: input.amountCents,
      description: input.description,
      category_id: input.categoryId,
      occurred_on: input.occurredOn,
      payment_method: input.paymentMethod,
    })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw { message: 'FORBIDDEN' };
}

export async function deleteTransaction(id: string): Promise<void> {
  const { data, error } = await getSupabase().from('transactions').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw { message: 'FORBIDDEN' };
}

/** Existe lançamento idêntico (tipo, valor, data e descrição)? Evita duplicar sem querer. */
export async function hasSimilarTransaction(workspaceId: string, input: TxInput): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('transactions')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('kind', input.kind)
    .eq('amount_cents', input.amountCents)
    .eq('occurred_on', input.occurredOn)
    .eq('description', input.description)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function countTransactionsBetween(workspaceId: string, from: string, to: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('occurred_on', from)
    .lte('occurred_on', to);
  if (error) throw error;
  return count ?? 0;
}

export async function getSummary(workspaceId: string, from: string, to: string): Promise<Summary> {
  const { data, error } = await getSupabase().rpc('workspace_summary', { p_workspace: workspaceId, p_from: from, p_to: to });
  if (error) throw error;
  return data as Summary;
}
