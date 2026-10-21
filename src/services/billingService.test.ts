import { describe, expect, it } from 'vitest';
import { errorInfo, mapBillingError } from './billingService';

describe('mapBillingError', () => {
  it.each([
    ['ALREADY_SUBSCRIBED', 'assinatura ativa'],
    ['FORBIDDEN', 'administrador'],
    ['TOO_MANY_REQUESTS', 'Aguarde'],
    ['PROVIDER_ERROR', 'Mercado Pago'],
    ['NOTHING_TO_CANCEL', 'Pix não renovam'],
    ['UNAUTHENTICATED', 'sessão expirou'],
    ['CARD_DISABLED', 'Use o Pix'],
    ['CODIGO_NOVO', 'Tente novamente'],
    [null, 'Tente novamente'],
    [undefined, 'Tente novamente'],
  ])('mapeia %s', (code, expected) => {
    expect(mapBillingError(code)).toContain(expected);
  });
});

describe('errorInfo', () => {
  const withBody = (body: unknown) => ({ context: new Response(JSON.stringify(body), { status: 502 }) });
  it('lê código e detalhe técnico do corpo da resposta', async () => {
    expect(await errorInfo(withBody({ error: 'PROVIDER_ERROR', detail: 'Both payer and collector must be real or test users' }))).toEqual({
      code: 'PROVIDER_ERROR',
      detail: 'Both payer and collector must be real or test users',
    });
  });
  it('sem detalhe (produção) devolve só o código', async () => {
    expect(await errorInfo(withBody({ error: 'FORBIDDEN' }))).toEqual({ code: 'FORBIDDEN', detail: null });
  });
  it('erros sem corpo JSON não quebram', async () => {
    expect(await errorInfo({ context: new Response('texto', { status: 500 }) })).toEqual({ code: null, detail: null });
    expect(await errorInfo(new Error('rede'))).toEqual({ code: null, detail: null });
    expect(await errorInfo(null)).toEqual({ code: null, detail: null });
  });
});
