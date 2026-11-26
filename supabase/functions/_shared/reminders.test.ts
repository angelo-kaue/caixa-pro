import { describe, expect, it } from 'vitest';
import { constantTimeEqual, isAllowedPushEndpoint, isSlot, pickMessage, startOfDayBRT } from './reminders.ts';

describe('startOfDayBRT', () => {
  it('antes das 03:00 UTC ainda é o dia anterior em Brasília', () => {
    expect(startOfDayBRT(new Date('2026-11-25T02:59:00Z')).toISOString()).toBe('2026-11-24T03:00:00.000Z');
  });
  it('a partir das 03:00 UTC começa o novo dia', () => {
    expect(startOfDayBRT(new Date('2026-11-25T03:00:00Z')).toISOString()).toBe('2026-11-25T03:00:00.000Z');
    expect(startOfDayBRT(new Date('2026-11-25T23:30:00Z')).toISOString()).toBe('2026-11-25T03:00:00.000Z');
  });
});

describe('pickMessage', () => {
  it('é estável no mesmo dia e muda de um dia para o outro', () => {
    const a = pickMessage('noon', new Date('2026-11-25T15:30:00Z'));
    expect(a).toEqual(pickMessage('noon', new Date('2026-11-25T16:00:00Z')));
    expect(pickMessage('noon', new Date('2026-11-26T15:30:00Z')).body).not.toBe(a.body);
    expect(a.title).toBe('CaixaPro');
  });
  it('todos os horários têm mensagem não vazia e curta', () => {
    for (const slot of ['noon', 'evening', 'night'] as const) {
      for (let d = 0; d < 8; d++) {
        const m = pickMessage(slot, new Date(Date.UTC(2026, 10, 25 + d, 15)));
        expect(m.body.length).toBeGreaterThan(10);
        expect(m.body.length).toBeLessThanOrEqual(90);
      }
    }
  });
  it('isSlot valida a entrada', () => {
    expect(isSlot('noon')).toBe(true);
    expect(isSlot('morning')).toBe(false);
    expect(isSlot(undefined)).toBe(false);
  });
});

describe('constantTimeEqual', () => {
  it('compara textos', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(constantTimeEqual('', 'a')).toBe(false);
  });
});

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])('aceita %s', (url) => expect(isAllowedPushEndpoint(url)).toBe(true));

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://evil.com/fcm.googleapis.com',
    'https://fcm.googleapis.com.evil.com/x',
    'https://evilgoogleapis.com/x',
    'https://localhost/x',
    'https://169.254.169.254/latest',
    'https://fcm.googleapis.com:8443/x',
    'não é url',
  ])('recusa %s', (url) => expect(isAllowedPushEndpoint(url)).toBe(false));
});
