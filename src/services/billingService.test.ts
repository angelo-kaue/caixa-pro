import { describe, expect, it } from 'vitest';
import { mapBillingError } from './billingService';

describe('mapBillingError', () => {
  it.each([
    ['ALREADY_SUBSCRIBED', 'assinatura ativa'],
    ['FORBIDDEN', 'administrador'],
    ['TOO_MANY_REQUESTS', 'Aguarde'],
    ['PROVIDER_ERROR', 'Mercado Pago'],
    ['NOTHING_TO_CANCEL', 'Pix não renovam'],
    ['UNAUTHENTICATED', 'sessão expirou'],
    ['CODIGO_NOVO', 'Tente novamente'],
    [null, 'Tente novamente'],
    [undefined, 'Tente novamente'],
  ])('mapeia %s', (code, expected) => {
    expect(mapBillingError(code)).toContain(expected);
  });
});
