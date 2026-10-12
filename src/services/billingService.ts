import { getSupabase } from '@/lib/supabase';
import type { SubscriptionInfo } from '@/types/db';

const MESSAGES: Record<string, string> = {
  ALREADY_SUBSCRIBED: 'Você já tem uma assinatura ativa deste plano no cartão.',
  FORBIDDEN: 'Só o administrador do espaço de trabalho pode alterar o plano.',
  TOO_MANY_REQUESTS: 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.',
  PROVIDER_ERROR: 'O Mercado Pago não conseguiu processar agora. Tente novamente em instantes.',
  NOTHING_TO_CANCEL: 'Não há assinatura recorrente ativa para cancelar. Pagamentos por Pix não renovam sozinhos.',
  UNAUTHENTICATED: 'Sua sessão expirou. Entre novamente.',
};

export function mapBillingError(code: string | null | undefined): string {
  return (code && MESSAGES[code]) || 'Não foi possível concluir agora. Tente novamente em instantes.';
}

/** Extrai o código (e, no modo de teste, o detalhe técnico) devolvidos pelas Edge Functions. */
export async function errorInfo(error: unknown): Promise<{ code: string | null; detail: string | null }> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as { error?: unknown; detail?: unknown };
      return { code: typeof body.error === 'string' ? body.error : null, detail: typeof body.detail === 'string' ? body.detail : null };
    } catch {
      return { code: null, detail: null };
    }
  }
  return { code: null, detail: null };
}

async function failure(error: unknown): Promise<Error> {
  const { code, detail } = await errorInfo(error);
  const base = mapBillingError(code);
  return new Error(detail ? `${base} Detalhe técnico (modo de teste): ${detail}` : base);
}

export async function createCheckout(plan: 'pro', mode: 'card' | 'pix'): Promise<string> {
  const { data, error } = await getSupabase().functions.invoke('create-checkout', { body: { plan, mode } });
  if (error) throw await failure(error);
  const url = (data as { url?: unknown } | null)?.url;
  if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error(mapBillingError(null));
  return url;
}

export async function cancelSubscription(): Promise<void> {
  const { error } = await getSupabase().functions.invoke('cancel-subscription', { body: {} });
  if (error) throw await failure(error);
}

export async function getSubscription(workspaceId: string): Promise<SubscriptionInfo | null> {
  const { data, error } = await getSupabase()
    .from('subscriptions')
    .select('plan_id, status, billing_mode, access_until, cancel_at_period_end')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  return (data as SubscriptionInfo | null) ?? null;
}
