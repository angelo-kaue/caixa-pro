/**
 * Utilitários monetários do CaixaPro.
 * Regra de ouro: dinheiro é SEMPRE inteiro em centavos. Nenhum float é usado em cálculos.
 */

/** Limite superior aceito: R$ 999.999.999,99 */
export const MAX_AMOUNT_CENTS = 99_999_999_999;

/**
 * Converte texto em formato brasileiro (ou internacional) para centavos.
 * Aceita: "50", "32,90", "1.234,56", "R$ 350", "350 reais", "186.40", "1,234.56".
 * Retorna null para qualquer entrada inválida ou ambígua (ex.: "1,234").
 */
export function parseMoneyToCents(input: string): number | null {
  if (typeof input !== 'string') return null;

  const s = input
    .toLowerCase()
    .replace(/r\$/g, '')
    .replace(/reais|real/g, '')
    .replace(/\s+/g, '');

  if (!/^\d[\d.,]*$/.test(s)) return null;

  const count = (c: string): number => s.split(c).length - 1;

  let decSep: ',' | '.' | null = null;
  if (s.includes(',') && s.includes('.')) {
    decSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
  } else if (s.includes(',')) {
    // Só vírgula: precisa ser decimal (1 vírgula, 1-2 casas). "1,234" é ambíguo e rejeitado.
    if (count(',') !== 1 || !/,\d{1,2}$/.test(s)) return null;
    decSep = ',';
  } else if (s.includes('.')) {
    // Só ponto: decimal se 1 ponto e 1-2 casas ("186.40"); senão separador de milhar ("1.234").
    decSep = count('.') === 1 && /\.\d{1,2}$/.test(s) ? '.' : null;
  }

  let intRaw = s;
  let frac = '';
  if (decSep) {
    const idx = s.lastIndexOf(decSep);
    intRaw = s.slice(0, idx);
    frac = s.slice(idx + 1);
    if (!/^\d{1,2}$/.test(frac)) return null;
  }

  const thousandsSep = decSep === '.' ? ',' : '.';
  if (intRaw.includes(',') || intRaw.includes('.')) {
    const re = thousandsSep === '.' ? /^\d{1,3}(\.\d{3})+$/ : /^\d{1,3}(,\d{3})+$/;
    if (!re.test(intRaw)) return null;
    intRaw = intRaw.split(thousandsSep).join('');
  } else if (!/^\d+$/.test(intRaw)) {
    return null;
  }

  if (intRaw.length > 12) return null;

  const cents = Number(intRaw) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

/** Valor aceitável para um lançamento: inteiro, positivo e dentro do limite. */
export function isValidAmountCents(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_AMOUNT_CENTS
  );
}

const intFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** Formata centavos como "R$ 1.234,56" usando só aritmética inteira. */
export function formatCentsToBRL(cents: number): string {
  if (!Number.isSafeInteger(cents)) return 'R$ —';
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const reais = Math.trunc(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}R$ ${intFormatter.format(reais)},${rest}`;
}

/** Soma segura de centavos. */
export function sumCents(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
