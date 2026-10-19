import { describe, expect, it } from 'vitest';
import { addDays, formatDateBR, formatRelativeDate, isValidYMD, monthBounds, shiftMonth } from './dates';

describe('dates', () => {
  it('valida dias do mês, inclusive bissexto', () => {
    expect(isValidYMD(2026, 2, 29)).toBe(false);
    expect(isValidYMD(2028, 2, 29)).toBe(true);
    expect(isValidYMD(2026, 4, 31)).toBe(false);
    expect(isValidYMD(2026, 13, 1)).toBe(false);
  });
  it('soma dias atravessando mês e ano', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('limites e deslocamento de mês', () => {
    expect(monthBounds('2026-02-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(shiftMonth('2026-01-20', -1)).toBe('2025-12-01');
    expect(shiftMonth('2026-10-10', 3)).toBe('2027-01-01');
  });
  it('formata em pt-BR', () => {
    expect(formatDateBR('2026-10-05')).toBe('05/10/2026');
  });
});

describe('formatRelativeDate', () => {
  it('hoje, ontem, mesmo ano e outro ano', () => {
    expect(formatRelativeDate('2026-10-17', '2026-10-17')).toBe('Hoje');
    expect(formatRelativeDate('2026-10-16', '2026-10-17')).toBe('Ontem');
    expect(formatRelativeDate('2026-09-30', '2026-10-17')).toBe('30/09');
    expect(formatRelativeDate('2025-12-31', '2026-10-17')).toBe('31/12/2025');
    expect(formatRelativeDate('2026-12-31', '2027-01-01')).toBe('Ontem');
  });
});
