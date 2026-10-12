import type { MpAuthorizedPayment, MpPayment, MpPreapproval } from './billing-core.ts';
import type { MpApi } from './billing-flow.ts';

const BASE = 'https://api.mercadopago.com';

export class MpError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
  ) {
    super(`Mercado Pago respondeu ${status} em ${path}`);
  }
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
    if (!res.ok) throw new MpError(res.status, path);
    return (await res.json()) as T;
  }

  return {
    getPreapproval: (id) => call<MpPreapproval>('GET', `/preapproval/${encodeURIComponent(id)}`),
    getAuthorizedPayment: (id) => call<MpAuthorizedPayment>('GET', `/authorized_payments/${encodeURIComponent(id)}`),
    getPayment: (id) => call<MpPayment>('GET', `/v1/payments/${encodeURIComponent(id)}`),
    cancelPreapproval: async (id) => {
      await call('PUT', `/preapproval/${encodeURIComponent(id)}`, { status: 'cancelled' });
    },
    createPreapproval: (body) => call<CreatedPreapproval>('POST', '/preapproval', body),
    createPreference: (body) => call<CreatedPreference>('POST', '/checkout/preferences', body),
  };
}
