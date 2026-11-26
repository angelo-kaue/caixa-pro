import { describe, expect, it } from 'vitest';
import { b64urlToBytes, bytesToB64url, encryptPayload, sendWebPush, vapidAuthorization } from './webpush.ts';

const subtle = crypto.subtle;
const ec = { name: 'ECDH', namedCurve: 'P-256' } as const;

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** Lado do navegador (RFC 8291), escrito à parte para conferir a criptografia. */
async function decrypt(body: Uint8Array, uaPrivate: CryptoKey, uaPublic: Uint8Array, authSecret: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const salt = body.slice(0, 16);
  const idLen = body[20] ?? 0;
  const asPublic = body.slice(21, 21 + idLen);
  const cipher = body.slice(21 + idLen);
  const asKey = await subtle.importKey('raw', asPublic, ec, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, uaPrivate, 256));
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(authSecret, shared, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher));
  let end = plain.length;
  while (end > 0 && plain[end - 1] === 0) end--;
  expect(plain[end - 1]).toBe(2); // delimitador do último registro
  return new TextDecoder().decode(plain.slice(0, end - 1));
}

describe('base64url', () => {
  it('ida e volta', () => {
    const bytes = new Uint8Array([0, 250, 251, 252, 253, 254, 255, 1, 2]);
    expect(b64urlToBytes(bytesToB64url(bytes))).toEqual(bytes);
    expect(bytesToB64url(bytes)).not.toMatch(/[+/=]/);
  });
});

describe('encryptPayload', () => {
  it('reproduz o exemplo oficial da RFC 8291 (apêndice A)', async () => {
    const asPublic = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
    const raw = b64urlToBytes(asPublic);
    const ephemeral: CryptoKeyPair = {
      publicKey: await subtle.importKey('raw', raw, ec, true, []),
      privateKey: await subtle.importKey(
        'jwk',
        { kty: 'EC', crv: 'P-256', x: bytesToB64url(raw.slice(1, 33)), y: bytesToB64url(raw.slice(33, 65)), d: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', ext: true },
        ec,
        false,
        ['deriveBits'],
      ),
    };
    const body = await encryptPayload(
      new TextEncoder().encode('When I grow up, I want to be a watermelon'),
      'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
      'BTBZMqHH6r4Tts7J_aSIgg',
      { salt: b64urlToBytes('DGv6ra1nlYgDCS1FRnbzlw'), ephemeral },
    );
    expect(bytesToB64url(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    );
  });

  it('o navegador consegue decifrar o que enviamos (chaves aleatórias, acentos)', async () => {
    const ua = (await subtle.generateKey(ec, true, ['deriveBits'])) as CryptoKeyPair;
    const uaPublic = new Uint8Array(await subtle.exportKey('raw', ua.publicKey));
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const text = JSON.stringify({ title: 'CaixaPro', body: 'Já registrou o gasto de hoje? ✅' });
    const body = await encryptPayload(new TextEncoder().encode(text), bytesToB64url(uaPublic), bytesToB64url(auth));
    expect(await decrypt(body, ua.privateKey, uaPublic, auth)).toBe(text);
  });

  it('cada envio usa sal e chave efêmera novos', async () => {
    const ua = (await subtle.generateKey(ec, true, ['deriveBits'])) as CryptoKeyPair;
    const pub = bytesToB64url(new Uint8Array(await subtle.exportKey('raw', ua.publicKey)));
    const a = await encryptPayload(new Uint8Array([1]), pub, 'BTBZMqHH6r4Tts7J_aSIgg');
    const b = await encryptPayload(new Uint8Array([1]), pub, 'BTBZMqHH6r4Tts7J_aSIgg');
    expect(bytesToB64url(a)).not.toBe(bytesToB64url(b));
  });
});

describe('VAPID', () => {
  it('gera um JWT ES256 com a assinatura válida para a chave pública', async () => {
    const pair = (await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = await subtle.exportKey('jwk', pair.privateKey);
    const publicKey = bytesToB64url(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)));
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', { publicKey, privateKey: jwk.d ?? '', subject: 'mailto:eu@exemplo.com' }, 1_800_000_000);

    const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header);
    expect(m).not.toBeNull();
    const [, h, c, s, k] = m ?? [];
    expect(k).toBe(publicKey);
    expect(JSON.parse(new TextDecoder().decode(b64urlToBytes(h ?? '')))).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(new TextDecoder().decode(b64urlToBytes(c ?? '')))).toEqual({ aud: 'https://fcm.googleapis.com', exp: 1_800_000_000 + 12 * 3600, sub: 'mailto:eu@exemplo.com' });
    const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, b64urlToBytes(s ?? ''), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });
});

describe('sendWebPush', () => {
  async function setup() {
    const ua = (await subtle.generateKey(ec, true, ['deriveBits'])) as CryptoKeyPair;
    const sign = (await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = await subtle.exportKey('jwk', sign.privateKey);
    return {
      target: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/xyz',
        p256dh: bytesToB64url(new Uint8Array(await subtle.exportKey('raw', ua.publicKey))),
        auth_key: 'BTBZMqHH6r4Tts7J_aSIgg',
      },
      vapid: { publicKey: bytesToB64url(new Uint8Array(await subtle.exportKey('raw', sign.publicKey))), privateKey: jwk.d ?? '', subject: 'mailto:eu@exemplo.com' },
    };
  }

  it('envia os cabeçalhos corretos e marca 404/410 como inscrição encerrada', async () => {
    const { target, vapid } = await setup();
    let seen: { url: string; init: RequestInit } | null = null;
    const make = (status: number) =>
      (async (url: string, init: RequestInit) => {
        seen = { url, init };
        return new Response('', { status });
      }) as unknown as typeof fetch;

    const ok = await sendWebPush(target, { title: 'x' }, vapid, { fetchFn: make(201) });
    expect(ok).toEqual({ status: 201, gone: false });
    const headers = (seen as { init: RequestInit } | null)?.init.headers as Record<string, string>;
    expect(headers['Content-Encoding']).toBe('aes128gcm');
    expect(headers.TTL).toBe('3600');
    expect(headers.Authorization).toMatch(/^vapid t=.+, k=.+$/);

    expect((await sendWebPush(target, {}, vapid, { fetchFn: make(410) })).gone).toBe(true);
    expect((await sendWebPush(target, {}, vapid, { fetchFn: make(404) })).gone).toBe(true);
    expect((await sendWebPush(target, {}, vapid, { fetchFn: make(500) })).gone).toBe(false);
  });
});
