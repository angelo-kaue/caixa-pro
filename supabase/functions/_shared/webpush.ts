// Web Push sem dependências: criptografia aes128gcm (RFC 8291) + autenticação VAPID (RFC 8292),
// só com WebCrypto e fetch (roda no Deno das Edge Functions e no Node dos testes).

const enc = new TextEncoder();

/** Os tipos mais novos do TypeScript (Deno) exigem ArrayBuffer puro; nossos Uint8Array são equivalentes. */
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

export function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', bs(ikm), 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: bs(salt), info: bs(info) }, key, length * 8));
}

export interface EncryptOptions {
  /** Só para testes (vetor da RFC): fixa o sal e o par de chaves efêmero. */
  salt?: Uint8Array;
  ephemeral?: CryptoKeyPair;
}

/** Corpo da requisição Web Push: cabeçalho (sal, tamanho do registro, chave efêmera) + texto cifrado. */
export async function encryptPayload(payload: Uint8Array, p256dh: string, authSecret: string, opts: EncryptOptions = {}): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(p256dh);
  const auth = b64urlToBytes(authSecret);
  const asKeys = opts.ephemeral ?? ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', bs(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));

  const ikm = await hkdf(auth, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', bs(cek), 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(nonce) }, aes, bs(concat(payload, new Uint8Array([2])))));
  const header = concat(salt, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([asPublic.length]), asPublic); // rs = 4096
  return concat(header, cipher);
}

export interface VapidKeys {
  /** Chave pública, 65 bytes em base64url. */
  publicKey: string;
  /** Chave privada, 32 bytes em base64url. */
  privateKey: string;
  /** "mailto:contato@..." ou uma URL https. */
  subject: string;
}

export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const pub = b64urlToBytes(vapid.publicKey);
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), d: vapid.privateKey, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = bytesToB64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSec + 12 * 3600, sub: vapid.subject })));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${bytesToB64url(signature)}, k=${vapid.publicKey}`;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

export interface PushResult {
  status: number;
  /** 404/410: o aparelho cancelou a inscrição; deve ser removida. */
  gone: boolean;
}

export async function sendWebPush(
  target: PushTarget,
  message: unknown,
  vapid: VapidKeys,
  opts: { ttlSeconds?: number; fetchFn?: typeof fetch } = {},
): Promise<PushResult> {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), target.p256dh, target.auth_key);
  const res = await (opts.fetchFn ?? fetch)(target.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(target.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(opts.ttlSeconds ?? 3600),
      Urgency: 'normal',
    },
    body: bs(body),
  });
  await res.text().catch(() => '');
  return { status: res.status, gone: res.status === 404 || res.status === 410 };
}
