import { describe, expect, it } from 'vitest';
import {
  MAX_AMOUNT_CENTS,
  formatCentsToBRL,
  isValidAmountCents,
  parseMoneyToCents,
  sumCents,
} from './money';

describe('parseMoneyToCents', () => {
  it.each([
    ['50', 5000],
    ['32,90', 3290],
    ['32,9', 3290],
    ['186,40', 18640],
    ['186.40', 18640],
    ['2500', 250000],
    ['1.234,56', 123456],
    ['1.234.567,89', 123456789],
    ['1,234.56', 123456],
    ['1.234', 123400],
    ['R$ 350', 35000],
    ['R$350,00', 35000],
    ['350 reais', 35000],
    ['99,90', 9990],
    ['0,05', 5],
    ['0', 0],
  ])('interpreta %s como %i centavos', (input, expected) => {
    expect(parseMoneyToCents(input)).toBe(expected);
  });

  it.each([
    [''],
    ['abc'],
    ['-50'],
    ['1,234'],
    ['1,2,3'],
    ['12,345,67'],
    ['1.23.45'],
    ['10,999'],
    ['1..2'],
    [',50'],
    ['9999999999999'],
  ])('rejeita entrada inválida ou ambígua: "%s"', (input) => {
    expect(parseMoneyToCents(input)).toBeNull();
  });

  it('respeita o limite máximo', () => {
    expect(parseMoneyToCents('999.999.999,99')).toBe(MAX_AMOUNT_CENTS);
    expect(parseMoneyToCents('1.000.000.000,00')).toBeNull();
  });

  it('não sofre com erros de ponto flutuante', () => {
    expect(parseMoneyToCents('0,29')).toBe(29);
    expect(parseMoneyToCents('1,15')).toBe(115);
    expect(parseMoneyToCents('19,90')).toBe(1990);
  });
});

describe('isValidAmountCents', () => {
  it('aceita apenas inteiros positivos dentro do limite', () => {
    expect(isValidAmountCents(1)).toBe(true);
    expect(isValidAmountCents(MAX_AMOUNT_CENTS)).toBe(true);
    expect(isValidAmountCents(0)).toBe(false);
    expect(isValidAmountCents(-5)).toBe(false);
    expect(isValidAmountCents(10.5)).toBe(false);
    expect(isValidAmountCents(NaN)).toBe(false);
    expect(isValidAmountCents(MAX_AMOUNT_CENTS + 1)).toBe(false);
    expect(isValidAmountCents('10')).toBe(false);
  });
});

describe('formatCentsToBRL', () => {
  it('formata valores em reais', () => {
    expect(formatCentsToBRL(0)).toBe('R$ 0,00');
    expect(formatCentsToBRL(5)).toBe('R$ 0,05');
    expect(formatCentsToBRL(3290)).toBe('R$ 32,90');
    expect(formatCentsToBRL(123456)).toBe('R$ 1.234,56');
    expect(formatCentsToBRL(-1990)).toBe('-R$ 19,90');
  });
});

describe('sumCents', () => {
  it('soma sem erro de arredondamento', () => {
    expect(sumCents([10, 20, 30])).toBe(60);
    expect(sumCents([])).toBe(0);
  });
});
