/** Só redirecionamos o usuário para páginas de pagamento do próprio Mercado Pago (defesa extra contra redirecionamento falso). */
export function isTrustedCheckoutUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '') return false;
  return /(^|\.)(mercadopago\.com(\.br)?|mercadolivre\.com\.br|mercadolibre\.com)$/.test(url.hostname);
}
