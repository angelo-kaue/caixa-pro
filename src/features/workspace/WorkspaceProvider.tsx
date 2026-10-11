import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PLANS, type PlanId } from '@/config/plans';
import type { Kind, UserRule } from '@/domain/categorizer';
import { monthBounds, todayISO } from '@/domain/dates';
import { mapDbError } from '@/services/dbErrors';
import { countTransactionsBetween } from '@/services/transactionService';
import { getMyWorkspace, getWorkspacePlan, listCategories, listRules } from '@/services/workspaceService';
import type { Category, CategoryRuleRow, Workspace } from '@/types/db';
import { useAuth } from '@/features/auth/AuthProvider';

type Status = 'loading' | 'none' | 'ready' | 'error';

interface Usage {
  count: number;
  limit: number | null;
}

interface WorkspaceContextValue {
  status: Status;
  error: string | null;
  workspace: Workspace | null;
  plan: PlanId;
  categories: Category[];
  userRules: UserRule[];
  usage: Usage | null;
  /** Muda a cada gravação; telas dependem dele para recarregar dados. */
  dataVersion: number;
  reload: () => Promise<void>;
  bump: () => void;
  findCategory: (kind: Kind, name: string | null) => Category | undefined;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [plan, setPlan] = useState<PlanId>('free');
  const [categories, setCategories] = useState<Category[]>([]);
  const [ruleRows, setRuleRows] = useState<CategoryRuleRow[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const load = useCallback(async (): Promise<void> => {
    setStatus('loading');
    setError(null);
    try {
      const ws = await getMyWorkspace();
      if (!ws) {
        setWorkspace(null);
        setStatus('none');
        return;
      }
      const [p, cats, rules] = await Promise.all([getWorkspacePlan(ws.id), listCategories(ws.id), listRules(ws.id)]);
      setWorkspace(ws);
      setPlan(p);
      setCategories(cats);
      setRuleRows(rules);
      setStatus('ready');
    } catch (e) {
      setError(mapDbError(e));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  // Uso do mês e regras de classificação são atualizados a cada gravação.
  useEffect(() => {
    if (status !== 'ready' || !workspace || dataVersion === 0) return;
    let active = true;
    void listRules(workspace.id).then((rows) => active && setRuleRows(rows)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [dataVersion, status, workspace]);

  useEffect(() => {
    if (status !== 'ready' || !workspace) return;
    let active = true;
    const { from, to } = monthBounds(todayISO());
    void countTransactionsBetween(workspace.id, from, to)
      .then((count) => active && setUsage({ count, limit: PLANS[plan].limits.maxTransactionsPerMonth }))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [dataVersion, status, workspace, plan]);

  const userRules = useMemo<UserRule[]>(() => {
    const byId = new Map(categories.map((c) => [c.id, c.name]));
    return ruleRows.flatMap((r) => {
      const category = byId.get(r.category_id);
      return category ? [{ keyword: r.keyword, category }] : [];
    });
  }, [ruleRows, categories]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      status,
      error,
      workspace,
      plan,
      categories,
      userRules,
      usage,
      dataVersion,
      reload: load,
      bump: () => setDataVersion((v) => v + 1),
      findCategory: (kind, name) => (name ? categories.find((c) => c.kind === kind && c.name === name) : undefined),
    }),
    [status, error, workspace, plan, categories, userRules, usage, dataVersion, load],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace deve ser usado dentro de <WorkspaceProvider>');
  return ctx;
}
