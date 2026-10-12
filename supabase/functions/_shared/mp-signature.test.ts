import { describe, expect, it } from 'vitest';
import { buildManifest, parseSignatureHeader, signMp, timingSafeEqual, verifyMpSignature } from './mp-signature.ts';

const secret = 'segredo-de-teste';

describe('parseSignatureHeader', () => {
  it('extrai ts e v1', () => {
    expect(parseSignatureHeader('ts=1704908010,v1=abc123')).toEqual({ ts: '1704908010', v1: 'abc123' });
    expect(parseSignatureHeader(' ts=1 , v1=ff ')).toEqual({ ts: '1', v1: 'ff' });
  });
  it('rejeita cabeçalhos ausentes ou incompletos', () => {
    expect(parseSignatureHeader(null)).toBeNull();
    expect(parseSignatureHeader('')).toBeNull();
    expect(parseSignatureHeader('ts=1')).toBeNull();
    expect(parseSignatureHeader('v1=abc')).toBeNull();
    expect(parseSignatureHeader('lixo')).toBeNull();
  });
});

describe('buildManifest', () => {
  it('segue o template oficial, com id em minúsculas', () => {
    expect(buildManifest('123456', 'bb56a2f1-6aae-46ac-982e-9dcd3581d08e', '1742505638683')).toBe('id:123456;request-id:bb56a2f1-6aae-46ac-982e-9dcd3581d08e;ts:1742505638683;');
    expect(buildManifest('ABC123', 'req', '1')).toBe('id:abc123;request-id:req;ts:1;');
  });
  it('omite campos ausentes', () => {
    expect(buildManifest('9', null, '5')).toBe('id:9;ts:5;');
    expect(buildManifest(null, 'r', '5')).toBe('request-id:r;ts:5;');
  });
});

describe('timingSafeEqual', () => {
  it('compara strings', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('verifyMpSignature', () => {
  it('aceita uma assinatura válida', async () => {
    const header = await signMp(secret, '123456', 'req-1', '1742505638683');
    expect(await verifyMpSignature({ secret, signatureHeader: header, requestId: 'req-1', dataId: '123456' })).toBe(true);
  });

  it('aceita v1 em maiúsculas', async () => {
    const header = (await signMp(secret, '1', 'r', '2')).replace(/v1=(.*)$/, (_m, h: string) => `v1=${h.toUpperCase()}`);
    expect(await verifyMpSignature({ secret, signatureHeader: header, requestId: 'r', dataId: '1' })).toBe(true);
  });

  it('rejeita segredo errado, id adulterado, request-id adulterado e ts adulterado', async () => {
    const header = await signMp(secret, '123', 'req-1', '1000');
    const base = { secret, signatureHeader: header, requestId: 'req-1', dataId: '123' };
    expect(await verifyMpSignature(base)).toBe(true);
    expect(await verifyMpSignature({ ...base, secret: 'outro' })).toBe(false);
    expect(await verifyMpSignature({ ...base, dataId: '124' })).toBe(false);
    expect(await verifyMpSignature({ ...base, requestId: 'req-2' })).toBe(false);
    expect(await verifyMpSignature({ ...base, signatureHeader: header.replace('ts=1000', 'ts=1001') })).toBe(false);
  });

  it('falha fechada sem segredo, sem header ou sem data.id', async () => {
    const header = await signMp(secret, '1', 'r', '1');
    expect(await verifyMpSignature({ secret: undefined, signatureHeader: header, requestId: 'r', dataId: '1' })).toBe(false);
    expect(await verifyMpSignature({ secret: '', signatureHeader: header, requestId: 'r', dataId: '1' })).toBe(false);
    expect(await verifyMpSignature({ secret, signatureHeader: null, requestId: 'r', dataId: '1' })).toBe(false);
    expect(await verifyMpSignature({ secret, signatureHeader: header, requestId: 'r', dataId: null })).toBe(false);
    expect(await verifyMpSignature({ secret, signatureHeader: 'ts=1,v1=zzz', requestId: 'r', dataId: '1' })).toBe(false);
  });
});
