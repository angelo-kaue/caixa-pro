export function decodeBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function toIso(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function num(m: RegExpExecArray, i: number): number {
  return Number(m[i] ?? NaN);
}

/** Aceita dd/mm/aaaa, dd/mm/aa, aaaa-mm-dd, dd-mm-aaaa e aaaammdd[hhmmss] (OFX). */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return toIso(num(m, 1), num(m, 2), num(m, 3));
  m = /^(\d{2})[\/.-](\d{2})[\/.-](\d{4})/.exec(s);
  if (m) return toIso(num(m, 3), num(m, 2), num(m, 1));
  m = /^(\d{2})[\/.-](\d{2})[\/.-](\d{2})(?!\d)/.exec(s);
  if (m) return toIso(2000 + num(m, 3), num(m, 2), num(m, 1));
  m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  if (m) return toIso(num(m, 1), num(m, 2), num(m, 3));
  return null;
}

/**
 * Converte "1.234,56", "-1234.56", "R$ 1.234,56", "(123,45)", "123,45-", "123,45 D" em centavos (com sinal).
 * dotDecimal: use true para OFX, onde o ponto é sempre decimal.
 */
export function parseAmountToCents(raw: string, opts?: { dotDecimal?: boolean }): number | null {
  let s = raw.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/r\$|usd|brl|eur|\$|€|\s/gi, '');
  if (/-$/.test(s)) {
    neg = true;
    s = s.slice(0, -1);
  }
  if (/d$/i.test(s)) {
    neg = true;
    s = s.slice(0, -1);
  } else if (/c$/i.test(s)) {
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let intPart = s;
  let decPart = '';
  if (lastDot >= 0 && lastComma >= 0) {
    const sep = Math.max(lastDot, lastComma);
    intPart = s.slice(0, sep);
    decPart = s.slice(sep + 1);
  } else if (lastComma >= 0) {
    if (s.indexOf(',') === lastComma) {
      intPart = s.slice(0, lastComma);
      decPart = s.slice(lastComma + 1);
    }
  } else if (lastDot >= 0) {
    const multiple = s.indexOf('.') !== lastDot;
    const thousands = !opts?.dotDecimal && (multiple || /^\d{1,3}\.\d{3}$/.test(s));
    if (!thousands && !(opts?.dotDecimal && multiple)) {
      intPart = s.slice(0, lastDot);
      decPart = s.slice(lastDot + 1);
    }
  }
  const intDigits = intPart.replace(/[.,]/g, '') || '0';
  const frac = `${decPart.replace(/\D/g, '')}00`.slice(0, 2);
  const cents = Number(intDigits) * 100 + Number(frac);
  if (!Number.isSafeInteger(cents)) return null;
  return neg ? -cents : cents;
}
