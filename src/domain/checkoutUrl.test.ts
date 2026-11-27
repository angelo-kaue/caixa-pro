import { describe, expect, it } from 'vitest';
import { isTrustedCheckoutUrl } from './checkoutUrl';

describe('isTrustedCheckoutUrl', () => {
  it.each([
    'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123',
    'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=abc',
    'https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=1',
    'https://mercadopago.com/checkout',
  ])('aceita %s', (url) => expect(isTrustedCheckoutUrl(url)).toBe(true));

  it.each([
    'http://www.mercadopago.com.br/checkout',
    'https://mercadopago.com.br.evil.com/checkout',
    'https://evilmercadopago.com.br/checkout',
    'https://www.mercadopago.com.br@evil.com/checkout',
    'https://user:pass@www.mercadopago.com.br/x',
    'https://www.mercadopago.com.br:8443/x',
    'https://evil.com/?u=https://www.mercadopago.com.br',
    'javascript:alert(1)',
    '//www.mercadopago.com.br/x',
    '',
  ])('recusa %s', (url) => expect(isTrustedCheckoutUrl(url)).toBe(false));
});
