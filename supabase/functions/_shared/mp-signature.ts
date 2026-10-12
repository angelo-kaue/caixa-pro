/** Validação da assinatura (x-signature) dos webhooks do Mercado Pago. TypeScript puro (Deno e Node). */

export interface SignatureParts {
  ts: string;
  v1: string;
}

export function parseSignatureHeader(header: string | null): SignatureParts | null {
  if (!header) return null;
  let ts = '';
  let v1 = '';
  for (const part of header.split(',')) {
    const [key, ...rest] = part.split('=');
    const value = rest.join('=').trim();
    if (key?.trim() === 'ts') ts = value;
    else if (key?.trim() === 'v1') v1 = value;
  }
  return ts && v1 ? { ts, v1 } : null;
}

/** Template oficial: id:[data.id];request-id:[x-request-id];ts:[ts]; (campos ausentes são omitidos; id em minúsculas). */
export function buildManifest(dataId: string | null, requestId: string | null, ts: string): string {
  let manifest = '';
  if (dataId) manifest += `id:${dataId.toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  return manifest;
}

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparação em tempo constante para strings do mesmo tamanho. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface VerifyInput {
  secret: string | undefined;
  signatureHeader: string | null;
  requestId: string | null;
  /** O data.id vindo da query string da notificação. */
  dataId: string | null;
}

/** Falha fechada: sem segredo, sem header ou sem data.id, a notificação é rejeitada. */
export async function verifyMpSignature(input: VerifyInput): Promise<boolean> {
  if (!input.secret || !input.dataId) return false;
  const parts = parseSignatureHeader(input.signatureHeader);
  if (!parts) return false;
  const expected = await hmacHex(input.secret, buildManifest(input.dataId, input.requestId, parts.ts));
  return timingSafeEqual(expected, parts.v1.toLowerCase());
}

/** Gera a assinatura (útil em testes). */
export async function signMp(secret: string, dataId: string, requestId: string, ts: string): Promise<string> {
  return `ts=${ts},v1=${await hmacHex(secret, buildManifest(dataId, requestId, ts))}`;
}
