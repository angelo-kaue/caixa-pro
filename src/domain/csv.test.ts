import { describe, expect, it } from 'vitest';
import { categoriesToCsv, csvEscape, toCsv, transactionsToCsv } from './csv';

describe('csvEscape', () => {
  it('texto simples não muda', () => {
    expect(csvEscape('Uber')).toBe('Uber');
  });
  it('aplica aspas com separador, aspas e quebra de linha', () => {
    expect(csvEscape('a;b')).toBe('"a;b"');
    expect(csvEscape('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvEscape('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });
  it('neutraliza injeção de fórmula', () => {
    expect(csvEscape('=SOMA(A1:A2)')).toBe("'=SOMA(A1:A2)");
    expect(csvEscape('+55 11 9999')).toBe("'+55 11 9999");
    expect(csvEscape('-cmd')).toBe("'-cmd");
    expect(csvEscape('@usuario')).toBe("'@usuario");
    expect(csvEscape('=1;2')).toBe(`"'=1;2"`);
  });
});

describe('toCsv', () => {
  it('começa com BOM, usa ; e CRLF', () => {
    const out = toCsv([['a', 'b'], ['c', 'd']]);
    expect(out.startsWith('\uFEFF')).toBe(true);
    expect(out).toBe('\uFEFFa;b\r\nc;d\r\n');
  });
});

describe('transactionsToCsv', () => {
  it('formata datas e valores no padrão brasileiro', () => {
    const out = transactionsToCsv([
      { date: '2026-10-05', kind: 'expense', description: 'Uber', category: 'Transporte', payment: 'Pix', amountCents: 5000 },
      { date: '2026-10-01', kind: 'income', description: '=Salário', category: 'Salário', payment: '', amountCents: 250050 },
    ]);
    const lines = out.replace('\uFEFF', '').trim().split('\r\n');
    expect(lines[0]).toBe('Data;Tipo;Descrição;Categoria;Forma de pagamento;Valor (R$)');
    expect(lines[1]).toBe('05/10/2026;Despesa;Uber;Transporte;Pix;50,00');
    expect(lines[2]).toBe("01/10/2026;Receita;'=Salário;Salário;;2500,50");
  });
});

describe('categoriesToCsv', () => {
  it('lista períodos atual e anterior', () => {
    const out = categoriesToCsv([{ category: 'Transporte', kind: 'expense', currentCents: 1000, previousCents: 0 }]);
    expect(out).toContain('Transporte;Despesa;10,00;0,00');
  });
});
