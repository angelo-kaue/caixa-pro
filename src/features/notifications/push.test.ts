import { describe, expect, it } from 'vitest';
import { PushError, evaluateSupport, pushErrorMessage, urlBase64ToUint8Array } from './push';

const base = { hasServiceWorker: true, hasPushManager: true, hasNotification: true, isIOS: false, isStandalone: false };

describe('evaluateSupport', () => {
  it('navegador comum com tudo disponível está pronto', () => {
    expect(evaluateSupport(base)).toBe('ready');
  });
  it('iPhone fora do app instalado pede para instalar', () => {
    expect(evaluateSupport({ ...base, isIOS: true, hasPushManager: false })).toBe('needs-install');
    expect(evaluateSupport({ ...base, isIOS: true })).toBe('needs-install');
  });
  it('iPhone com o app instalado funciona', () => {
    expect(evaluateSupport({ ...base, isIOS: true, isStandalone: true })).toBe('ready');
  });
  it('sem push ou sem notificações não é suportado', () => {
    expect(evaluateSupport({ ...base, hasPushManager: false })).toBe('unsupported');
    expect(evaluateSupport({ ...base, hasNotification: false })).toBe('unsupported');
    expect(evaluateSupport({ ...base, hasServiceWorker: false })).toBe('unsupported');
  });
});

describe('urlBase64ToUint8Array', () => {
  it('converte uma chave VAPID de 65 bytes', () => {
    const key = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
    const bytes = urlBase64ToUint8Array(key);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4);
  });
});

describe('pushErrorMessage', () => {
  it('traduz os erros do app e cai na mensagem genérica para os outros', () => {
    expect(pushErrorMessage(new PushError('PERMISSION_DENIED'))).toMatch(/bloqueadas/);
    expect(pushErrorMessage(new PushError('SW_UNAVAILABLE'))).toMatch(/app publicado/);
    expect(pushErrorMessage(new Error('boom'))).toMatch(/Algo deu errado/);
  });
});
