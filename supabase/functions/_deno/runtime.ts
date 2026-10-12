// Código específico do ambiente Deno / Supabase Edge Functions (não é verificado pelo tsc do projeto).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { CheckoutRow, ExistingSub, PlanPrice } from '../_shared/billing-core.ts';
import type { BillingDb } from '../_shared/billing-flow.ts';

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/** Acesso total ao banco: use SÓ no servidor. A chave service_role nunca vai para o navegador. */
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: authOptions });
}

/** Cliente com o JWT do usuário: respeita o RLS como se fosse o próprio usuário. */
export function userClient(authorization: string): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: authOptions,
  });
}

/** CORS restrito às origens de APP_URL (lista separada por vírgulas). */
export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (Deno.env.get('APP_URL') ?? '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  const base = { 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
  return origin && allowed.includes(origin) ? { ...base, 'Access-Control-Allow-Origin': origin } : base;
}

export function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export function createBillingDb(sb: SupabaseClient): BillingDb {
  return {
    async getCheckout(id) {
      const { data, error } = await sb.from('billing_checkouts').select('id, workspace_id, plan_id, mode').eq('id', id).maybeSingle();
      if (error) throw error;
      return (data as CheckoutRow | null) ?? null;
    },
    async getPlanPrice(plan) {
      const { data, error } = await sb.from('plans').select('id, price_cents').eq('id', plan).maybeSingle();
      if (error) throw error;
      return (data as PlanPrice | null) ?? null;
    },
    async getSubscription(workspaceId) {
      const { data, error } = await sb
        .from('subscriptions')
        .select('plan_id, status, billing_mode, provider_subscription_id, access_until')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (error) throw error;
      return (data as ExistingSub | null) ?? null;
    },
    async applySubscription(p) {
      const { error } = await sb.rpc('apply_subscription_update', {
        p_workspace: p.workspaceId,
        p_plan: p.plan,
        p_status: p.status,
        p_access_until: p.accessUntil ? p.accessUntil.toISOString() : null,
        p_cancel_at_period_end: p.cancelAtPeriodEnd,
        p_provider_subscription_id: p.providerSubscriptionId,
        p_mode: p.mode,
      });
      if (error) throw error;
    },
    async grantPeriod(p) {
      const { data, error } = await sb.rpc('grant_paid_period', {
        p_workspace: p.workspaceId,
        p_plan: p.plan,
        p_days: p.days,
        p_event_key: p.eventKey,
        p_mode: p.mode,
        p_stack: p.stack,
      });
      if (error) throw error;
      return data === true;
    },
  };
}
