import type { Kind } from '@/domain/categorizer';
import type { PaymentMethod } from '@/domain/parser';
import { getSupabase } from '@/lib/supabase';
import type { Bill, BillsOverview, Budget, Goal, RecurringRule, SeriesPoint } from '@/types/db';

const sb = () => getSupabase();

/* ------------------------------ orçamentos ------------------------------ */

export async function listBudgets(workspaceId: string): Promise<Budget[]> {
  const { data, error } = await sb().from('budgets').select('id, category_id, amount_cents, active').eq('workspace_id', workspaceId).order('created_at');
  if (error) throw error;
  return (data ?? []) as Budget[];
}

export async function createBudget(workspaceId: string, categoryId: string, amountCents: number): Promise<void> {
  const { error } = await sb().from('budgets').insert({ workspace_id: workspaceId, category_id: categoryId, amount_cents: amountCents });
  if (error) throw error;
}

export async function updateBudget(id: string, patch: { amount_cents?: number; active?: boolean }): Promise<void> {
  const { data, error } = await sb().from('budgets').update(patch).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw { message: 'FORBIDDEN' };
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await sb().from('budgets').delete().eq('id', id);
  if (error) throw error;
}

/* -------------------------------- metas -------------------------------- */

export async function listGoals(workspaceId: string): Promise<Goal[]> {
  const { data, error } = await sb().from('goals').select('id, name, target_cents, current_cents, target_date').eq('workspace_id', workspaceId).order('created_at');
  if (error) throw error;
  return (data ?? []) as Goal[];
}

export async function createGoal(workspaceId: string, g: { name: string; targetCents: number; targetDate: string | null }): Promise<void> {
  const { error } = await sb().from('goals').insert({ workspace_id: workspaceId, name: g.name, target_cents: g.targetCents, target_date: g.targetDate });
  if (error) throw error;
}

export async function updateGoal(id: string, patch: { name?: string; target_cents?: number; target_date?: string | null; current_cents?: number }): Promise<void> {
  const { data, error } = await sb().from('goals').update(patch).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw { message: 'FORBIDDEN' };
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await sb().from('goals').delete().eq('id', id);
  if (error) throw error;
}

/* ------------------------------ recorrências ------------------------------ */

const RULE_COLUMNS = 'id, kind, amount_cents, description, category_id, payment_method, day_of_month, start_on, end_on, active';

export interface RuleInput {
  kind: Kind;
  amountCents: number;
  description: string;
  categoryId: string | null;
  paymentMethod: PaymentMethod | null;
  dayOfMonth: number;
  startOn: string;
  endOn: string | null;
}

const ruleRow = (r: RuleInput) => ({
  kind: r.kind,
  amount_cents: r.amountCents,
  description: r.description,
  category_id: r.categoryId,
  payment_method: r.paymentMethod,
  day_of_month: r.dayOfMonth,
  start_on: r.startOn,
  end_on: r.endOn,
});

export async function listRules(workspaceId: string): Promise<RecurringRule[]> {
  const { data, error } = await sb().from('recurring_rules').select(RULE_COLUMNS).eq('workspace_id', workspaceId).order('created_at');
  if (error) throw error;
  return (data ?? []) as RecurringRule[];
}

export async function createRule(workspaceId: string, r: RuleInput): Promise<void> {
  const { error } = await sb().from('recurring_rules').insert({ workspace_id: workspaceId, ...ruleRow(r) });
  if (error) throw error;
}

export async function updateRule(id: string, r: RuleInput): Promise<void> {
  const { data, error } = await sb().from('recurring_rules').update(ruleRow(r)).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw { message: 'FORBIDDEN' };
}

export async function setRuleActive(id: string, active: boolean): Promise<void> {
  const { data, error } = await sb().from('recurring_rules').update({ active }).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw { message: 'FORBIDDEN' };
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await sb().from('recurring_rules').delete().eq('id', id);
  if (error) throw error;
}

/** Cria os lançamentos recorrentes já vencidos. Idempotente. Retorna quantos foram criados. */
export async function generateRecurring(workspaceId: string): Promise<number> {
  const { data, error } = await sb().rpc('generate_recurring', { p_workspace: workspaceId });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/* ------------------------------ contas a pagar/receber ------------------------------ */

export interface BillInput {
  kind: Kind;
  description: string;
  amountCents: number;
  dueOn: string;
  categoryId: string | null;
}

export async function listBills(workspaceId: string, status: 'pending' | 'paid'): Promise<Bill[]> {
  let q = sb().from('bills').select('id, kind, description, amount_cents, due_on, category_id, status, paid_on').eq('workspace_id', workspaceId).eq('status', status);
  q = status === 'pending' ? q.order('due_on', { ascending: true }) : q.order('paid_on', { ascending: false });
  const { data, error } = await q.limit(100);
  if (error) throw error;
  return (data ?? []) as Bill[];
}

export async function createBill(workspaceId: string, b: BillInput): Promise<void> {
  const { error } = await sb().from('bills').insert({
    workspace_id: workspaceId,
    kind: b.kind,
    description: b.description,
    amount_cents: b.amountCents,
    due_on: b.dueOn,
    category_id: b.categoryId,
  });
  if (error) throw error;
}

export async function updateBill(id: string, b: BillInput): Promise<void> {
  const { data, error } = await sb()
    .from('bills')
    .update({ description: b.description, amount_cents: b.amountCents, due_on: b.dueOn, category_id: b.categoryId })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw { message: 'FORBIDDEN' };
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await sb().from('bills').delete().eq('id', id);
  if (error) throw error;
}

export async function settleBill(id: string, paidOn: string): Promise<void> {
  const { error } = await sb().rpc('settle_bill', { p_bill: id, p_paid_on: paidOn });
  if (error) throw error;
}

export async function reopenBill(id: string): Promise<void> {
  const { error } = await sb().rpc('reopen_bill', { p_bill: id });
  if (error) throw error;
}

export async function getBillsOverview(workspaceId: string): Promise<BillsOverview> {
  const { data, error } = await sb().rpc('bills_overview', { p_workspace: workspaceId });
  if (error) throw error;
  return data as BillsOverview;
}

/* ------------------------------ série mensal ------------------------------ */

export async function getMonthlySeries(workspaceId: string, months: number): Promise<SeriesPoint[]> {
  const { data, error } = await sb().rpc('monthly_series', { p_workspace: workspaceId, p_months: months });
  if (error) throw error;
  return (data ?? []) as SeriesPoint[];
}
