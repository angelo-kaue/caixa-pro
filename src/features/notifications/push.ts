import { mapDbError } from '@/services/dbErrors';
import { getSupabase } from '@/lib/supabase';

/** Chave pública VAPID (a privada fica só no servidor). Sem ela, a tela de lembretes não aparece. */
export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim();

export type PushSupport = 'unsupported' | 'needs-install' | 'ready';

export interface SupportInput {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  isIOS: boolean;
  isStandalone: boolean;
}

/** No iPhone os avisos só funcionam com o app instalado na tela de início. */
export function evaluateSupport(i: SupportInput): PushSupport {
  if (i.isIOS && !i.isStandalone) return 'needs-install';
  if (!i.hasServiceWorker || !i.hasPushManager || !i.hasNotification) return 'unsupported';
  return 'ready';
}

export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  const nav = navigator as Navigator & { standalone?: boolean };
  return evaluateSupport({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    isStandalone: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
  });
}

export function urlBase64ToUint8Array(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type PushErrorCode = 'NOT_CONFIGURED' | 'UNSUPPORTED' | 'PERMISSION_DENIED' | 'SW_UNAVAILABLE' | 'SUBSCRIBE_FAILED' | 'INVALID_SUBSCRIPTION';

export class PushError extends Error {
  readonly code: PushErrorCode;
  constructor(code: PushErrorCode) {
    super(code);
    this.code = code;
  }
}

const MESSAGES: Record<PushErrorCode, string> = {
  NOT_CONFIGURED: 'Os lembretes ainda não estão configurados.',
  UNSUPPORTED: 'Este navegador não permite notificações.',
  PERMISSION_DENIED: 'As notificações estão bloqueadas neste aparelho. Libere nas configurações do navegador (ou do app) e tente de novo.',
  SW_UNAVAILABLE: 'Os lembretes só funcionam no app publicado, não no modo de desenvolvimento. Abra o CaixaPro pelo endereço do site e tente de novo.',
  SUBSCRIBE_FAILED: 'Não foi possível ativar os lembretes neste aparelho. Tente de novo em instantes.',
  INVALID_SUBSCRIPTION: 'Não foi possível registrar este aparelho. Tente de novo.',
};

export function pushErrorMessage(e: unknown): string {
  return e instanceof PushError ? MESSAGES[e.code] : mapDbError(e);
}

async function getRegistration(timeoutMs = 4000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await getRegistration(1500);
  return reg ? reg.pushManager.getSubscription() : null;
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const data = sub.toJSON();
  const p256dh = data.keys?.p256dh;
  const auth = data.keys?.auth;
  if (!data.endpoint || !p256dh || !auth) throw new PushError('INVALID_SUBSCRIPTION');
  const { error } = await getSupabase().rpc('save_push_subscription', {
    p_endpoint: data.endpoint,
    p_p256dh: p256dh,
    p_auth_key: auth,
    p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options?.applicationServerKey;
  if (!current) return true;
  const a = new Uint8Array(current);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

/** Pede permissão, inscreve este aparelho e guarda a inscrição no servidor. */
export async function enablePush(): Promise<void> {
  if (!VAPID_PUBLIC_KEY) throw new PushError('NOT_CONFIGURED');
  if (getPushSupport() !== 'ready') throw new PushError('UNSUPPORTED');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new PushError('PERMISSION_DENIED');
  const reg = await getRegistration();
  if (!reg) throw new PushError('SW_UNAVAILABLE');

  const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    } catch {
      throw new PushError('SUBSCRIBE_FAILED');
    }
  }
  await saveSubscription(sub);
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const { error } = await getSupabase().rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
  if (error) throw error;
  await sub.unsubscribe();
}

/** Ao abrir o app logado: se este aparelho já recebe lembretes, garante que a inscrição pertence a quem está logado. */
export async function syncPush(): Promise<void> {
  try {
    if (!VAPID_PUBLIC_KEY || getPushSupport() !== 'ready' || Notification.permission !== 'granted') return;
    const sub = await currentSubscription();
    if (sub) await saveSubscription(sub);
  } catch {
    /* sincronização é só de conveniência; falhas não devem aparecer para o usuário */
  }
}

/** Pede ao servidor uma notificação de teste para os aparelhos do usuário. Devolve quantos receberam. */
export async function sendTestPush(): Promise<number> {
  const { data, error } = await getSupabase().functions.invoke('send-reminders', { body: { test: true } });
  if (error) throw error;
  const sent = (data as { sent?: unknown } | null)?.sent;
  return typeof sent === 'number' ? sent : 0;
}
