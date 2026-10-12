import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PLANS, hasFeature, type PlanId } from '@/config/plans';
import type { Kind, UserRule } from '@/domain/categorizer';
import { monthBounds, todayISO } from '@/domain/dates';
import { mapDbError } from '@/services/dbErrors';
import { getSubscription } from '@/services/billingService';
import { generateRecurring } from '@/services/planningService';
import { countTransactionsBetween } from '@/services/transactionService';
import { getMyWorkspace, getWorkspacePlan, listCategories, listRules } from '@/services/workspaceService';
import type { Category, CategoryRuleRow, SubscriptionInfo, Workspace } from '@/types/db';
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
  subscription: SubscriptionInfo | null;
  categories: Category[];
  userRules: UserRule[];
  usage: Usage | null;
  /** Muda a cada gravação; telas dependem dele para recarregar dados. */
  dataVersion: number;
  reload: () => Promise<void>;
  /** Rele plano e assinatura (usado após a contratação, enquanto o pagamento é confirmado). */
  refreshBilling: () => Promise<void>;
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
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
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
      const [p, cats, rules, sub] = await Promise.all([getWorkspacePlan(ws.id), listCategories(ws.id), listRules(ws.id), getSubscription(ws.id)]);
      setWorkspace(ws);
      setPlan(p);
      setSubscription(sub);
      setCategories(cats);
      setRuleRows(rules);
      setStatus('ready');
    } catch (e) {
      setError(mapDbError(e));
      setStatus('error');
    }
  }, []);

  const refreshBilling = useCallback(async (): Promise<void> => {
    if (!workspace) return;
    try {
      const [p, sub] = await Promise.all([getWorkspacePlan(workspace.id), getSubscription(workspace.id)]);
      setPlan(p);
      setSubscription(sub);
    } catch {
      /* mantém o estado anterior; a próxima tentativa corrige */
    }
  }, [workspace]);

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

  // Cria os lançamentos recorrentes já vencidos (Pro). Idempotente: pode rodar a cada abertura.
  const wsId = workspace?.id ?? null;
  useEffect(() => {
    if (status !== 'ready' || !wsId || !hasFeature(plan, 'recurring')) return;
    let active = true;
    void generateRecurring(wsId)
      .then((n) => {
        if (active && n > 0) setDataVersion((v) => v + 1);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [status, wsId, plan]);

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
      subscription,
      categories,
      userRules,
      usage,
      dataVersion,
      reload: load,
      refreshBilling,
      bump: () => setDataVersion((v) => v + 1),
      findCategory: (kind, name) => (name ? categories.find((c) => c.kind === kind && c.name === name) : undefined),
    }),
    [status, error, workspace, plan, subscription, categories, userRules, usage, dataVersion, load, refreshBilling],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace deve ser usado dentro de <WorkspaceProvider>');
  return ctx;
}
