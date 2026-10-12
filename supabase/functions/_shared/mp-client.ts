import type { MpAuthorizedPayment, MpPayment, MpPreapproval } from './billing-core.ts';
import type { MpApi } from './billing-flow.ts';

const BASE = 'https://api.mercadopago.com';

export class MpError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    /** Resumo seguro da resposta de erro do Mercado Pago (mensagem e causas). Nunca contém token nem dados de cartão. */
    public readonly detail: string | null = null,
  ) {
    super(`Mercado Pago respondeu ${status} em ${path}`);
  }
}

/** Extrai só os campos de diagnóstico da resposta de erro (message, error e cause[].code/description). */
export function describeErrorBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { message?: unknown; error?: unknown; cause?: unknown };
  const parts: string[] = [];
  if (typeof b.message === 'string') parts.push(b.message);
  if (typeof b.error === 'string') parts.push(`(${b.error})`);
  if (Array.isArray(b.cause)) {
    for (const c of b.cause.slice(0, 5)) {
      const cause = c as { code?: unknown; description?: unknown };
      const text = [cause.code, cause.description].filter((x) => typeof x === 'string' || typeof x === 'number').join(': ');
      if (text) parts.push(text);
    }
  }
  const text = parts.join(' ').trim();
  return text ? text.slice(0, 300) : null;
}

export interface CreatedPreapproval {
  id: string;
  init_point: string;
}
export interface CreatedPreference {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

/** Cliente mínimo da API. O token vem do ambiente do servidor e nunca é registrado em log. */
export function createMpClient(accessToken: string, fetchImpl: typeof fetch = fetch): MpApi & {
  createPreapproval(body: unknown): Promise<CreatedPreapproval>;
  createPreference(body: unknown): Promise<CreatedPreference>;
} {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetchImpl(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(method === 'POST' ? { 'X-Idempotency-Key': crypto.randomUUID() } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      let detail: string | null = null;
      try {
        detail = describeErrorBody(await res.json());
      } catch {
        /* resposta sem JSON */
      }
      throw new MpError(res.status, path, detail);
    }
    return (await res.json()) as T;
  }

  return {
    getPreapproval: (id) => call<MpPreapproval>('GET', `/preapproval/${encodeURIComponent(id)}`),
    getAuthorizedPayment: (id) => call<MpAuthorizedPayment>('GET', `/authorized_payments/${encodeURIComponent(id)}`),
    getPayment: (id) => call<MpPayment>('GET', `/v1/payments/${encodeURIComponent(id)}`),
    searchPaymentsByReference: async (reference) => {
      const out = await call<{ results?: MpPayment[] }>('GET', `/v1/payments/search?external_reference=${encodeURIComponent(reference)}&sort=date_created&criteria=desc&limit=10`);
      return out.results ?? [];
    },
    cancelPreapproval: async (id) => {
      await call('PUT', `/preapproval/${encodeURIComponent(id)}`, { status: 'cancelled' });
    },
    createPreapproval: (body) => call<CreatedPreapproval>('POST', '/preapproval', body),
    createPreference: (body) => call<CreatedPreference>('POST', '/checkout/preferences', body),
  };
}
