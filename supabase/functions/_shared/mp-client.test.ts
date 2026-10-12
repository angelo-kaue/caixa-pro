import { describe, expect, it, vi } from 'vitest';
import { MpError, createMpClient } from './mp-client.ts';

function fakeFetch(status: number, json: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('createMpClient', () => {
  it('consulta recursos com Bearer e sem enviar corpo', async () => {
    const f = fakeFetch(200, { id: 'pre-1', status: 'authorized' });
    const mp = createMpClient('TOKEN-SECRETO', f);
    expect(await mp.getPreapproval('pre-1')).toMatchObject({ id: 'pre-1' });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.mercadopago.com/preapproval/pre-1');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN-SECRETO');
    expect(init.body).toBeUndefined();
  });

  it('usa os caminhos corretos', async () => {
    const f = fakeFetch(200, { id: 1 });
    const mp = createMpClient('t', f);
    await mp.getPayment('555');
    await mp.getAuthorizedPayment('9');
    const urls = (f as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c as [string])[0]);
    expect(urls).toEqual(['https://api.mercadopago.com/v1/payments/555', 'https://api.mercadopago.com/authorized_payments/9']);
  });

  it('cancela assinatura com PUT status cancelled', async () => {
    const f = fakeFetch(200, { id: 'pre-1', status: 'cancelled' });
    await createMpClient('t', f).cancelPreapproval('pre-1');
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.mercadopago.com/preapproval/pre-1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({ status: 'cancelled' });
  });

  it('criações enviam chave de idempotência', async () => {
    const f = fakeFetch(201, { id: 'x', init_point: 'https://mp/checkout' });
    const out = await createMpClient('t', f).createPreapproval({ reason: 'x' });
    expect(out.init_point).toBe('https://mp/checkout');
    const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('erros HTTP viram MpError sem vazar o token', async () => {
    const mp = createMpClient('TOKEN-SECRETO', fakeFetch(401, { message: 'invalid' }));
    const err = await mp.getPayment('1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MpError);
    expect((err as MpError).status).toBe(401);
    expect(String((err as Error).message)).not.toContain('TOKEN-SECRETO');
  });

  it('codifica ids na URL', async () => {
    const f = fakeFetch(200, { id: 'x' });
    await createMpClient('t', f).getPreapproval('a/b?c');
    expect(((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string])[0]).toBe('https://api.mercadopago.com/preapproval/a%2Fb%3Fc');
  });
});
