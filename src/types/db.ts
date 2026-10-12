import type { Kind } from '@/domain/categorizer';
import type { PaymentMethod } from '@/domain/parser';

export type WorkspaceType = 'personal' | 'business';

export interface Workspace {
  id: string;
  type: WorkspaceType;
  name: string;
  initial_balance_cents: number;
}

export interface Category {
  id: string;
  name: string;
  kind: Kind;
  is_system: boolean;
}

export interface CategoryRuleRow {
  keyword: string;
  category_id: string;
}

export interface Transaction {
  id: string;
  workspace_id: string;
  kind: Kind;
  amount_cents: number;
  description: string;
  category_id: string | null;
  occurred_on: string;
  payment_method: PaymentMethod | null;
  created_at: string;
}

export interface SummaryCategory {
  category_id: string | null;
  name: string | null;
  kind: Kind;
  total_cents: number;
  count: number;
}

export interface Summary {
  balance_cents: number;
  income_cents: number;
  expense_cents: number;
  effective_from: string;
  categories: SummaryCategory[];
}

export interface Budget {
  id: string;
  category_id: string;
  amount_cents: number;
  active: boolean;
}

export interface Goal {
  id: string;
  name: string;
  target_cents: number;
  current_cents: number;
  target_date: string | null;
}

export interface RecurringRule {
  id: string;
  kind: Kind;
  amount_cents: number;
  description: string;
  category_id: string | null;
  payment_method: PaymentMethod | null;
  day_of_month: number;
  start_on: string;
  end_on: string | null;
  active: boolean;
}

export interface Bill {
  id: string;
  /** expense = a pagar, income = a receber */
  kind: Kind;
  description: string;
  amount_cents: number;
  due_on: string;
  category_id: string | null;
  status: 'pending' | 'paid';
  paid_on: string | null;
}

export interface BillsOverview {
  payable_cents: number;
  receivable_cents: number;
  overdue_payable_cents: number;
  overdue_receivable_cents: number;
  overdue_count: number;
}

export interface SeriesPoint {
  month: string;
  income_cents: number;
  expense_cents: number;
}

export interface SubscriptionInfo {
  plan_id: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  billing_mode: 'card' | 'pix' | null;
  access_until: string | null;
  cancel_at_period_end: boolean;
}
