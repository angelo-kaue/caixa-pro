import type { PlanId } from '@/config/plans';
import { getSupabase } from '@/lib/supabase';
import type { Category, CategoryRuleRow, Workspace, WorkspaceType } from '@/types/db';

export async function getMyWorkspace(): Promise<Workspace | null> {
  const { data, error } = await getSupabase()
    .from('workspaces')
    .select('id, type, name, initial_balance_cents')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Workspace | null) ?? null;
}

export async function getWorkspacePlan(workspaceId: string): Promise<PlanId> {
  const { data, error } = await getSupabase().rpc('workspace_plan', { p_workspace: workspaceId });
  if (error) throw error;
  return (data as PlanId | null) ?? 'free';
}

export async function createWorkspace(type: WorkspaceType, name: string, initialBalanceCents: number): Promise<string> {
  const { data, error } = await getSupabase().rpc('create_workspace', {
    p_type: type,
    p_name: name,
    p_initial_balance_cents: initialBalanceCents,
  });
  if (error) throw error;
  return data as string;
}

export async function listCategories(workspaceId: string): Promise<Category[]> {
  const { data, error } = await getSupabase()
    .from('categories')
    .select('id, name, kind, is_system')
    .eq('workspace_id', workspaceId)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function listRules(workspaceId: string): Promise<CategoryRuleRow[]> {
  const { data, error } = await getSupabase()
    .from('category_rules')
    .select('keyword, category_id')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  return (data ?? []) as CategoryRuleRow[];
}

/** Guarda (ou atualiza) a preferência de classificação do usuário. */
export async function saveRule(workspaceId: string, keyword: string, categoryId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('category_rules')
    .upsert({ workspace_id: workspaceId, keyword, category_id: categoryId }, { onConflict: 'workspace_id,keyword' });
  if (error) throw error;
}
