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
