import { describe, expect, it } from 'vitest';
import { buildReview } from './dedupe';
import { hashToUuid } from './hash';
import { extractCsvRows, prepareCsv } from './parseCsv';
import { parseOfx } from './parseOfx';
import { guessPayment } from './payment';
import { parseAmountToCents, parseDate } from './util';
import type { ExistingTx } from './types';

const SGML = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>260<ACCTID>12345-6</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261103000000[-3:BRT]
<TRNAMT>-45.90
<FITID>abc-1
<MEMO>Compra no débito - PADARIA SÃO JOSÉ
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261104
<TRNAMT>1500.00
<FITID>abc-2
<NAME>PIX RECEBIDO
<MEMO>Maria Silva
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261104
<TRNAMT>-8.00
<FITID>abc-3
<NAME>CAFE &amp; CIA
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const XML = `<?xml version="1.0"?><OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261110</DTPOSTED><TRNAMT>-99.99</TRNAMT><FITID>x1</FITID><MEMO>Netflix</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261111</DTPOSTED><TRNAMT>-10.00</TRNAMT><FITID>x2</FITID><MEMO>Uber</MEMO></STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;

const NUBANK = `Data,Valor,Identificador,Descrição
03/11/2026,-45.90,id-1,"Padaria, São José"
04/11/2026,1500.00,id-2,Pix recebido
`;

const INTER = `Extrato Conta Corrente
Conta;12345
Período;01/11/2026 a 30/11/2026

Data Lançamento;Histórico;Descrição;Débito;Crédito;Saldo
01/11/2026;SALDO ANTERIOR;;;;1.000,00
02/11/2026;Pix enviado;JOAO PEDRO;120,50;;879,50
03/11/2026;Pix recebido;ANA;;"2.300,00";3.179,50
03/11/2026;Compra;MERCADO X;35,00;;3.144,50
03/11/2026;Compra;MERCADO X;35,00;;3.109,50
`;

describe('parseAmountToCents', () => {
  it.each([
    ['1.234,56', 123456],
    ['-1.234,56', -123456],
    ['R$ 12,30', 1230],
    ['(45,00)', -4500],
    ['45,00-', -4500],
    ['45,00 D', -4500],
    ['-1234.56', -123456],
    ['1.234', 123400],
    ['50', 5000],
  ])('%s -> %i', (input, cents) => expect(parseAmountToCents(input)).toBe(cents));

  it('OFX usa ponto como decimal', () => {
    expect(parseAmountToCents('-12.5', { dotDecimal: true })).toBe(-1250);
    expect(parseAmountToCents('-1.234', { dotDecimal: true })).toBe(-123);
  });
  it('rejeita lixo', () => expect(parseAmountToCents('abc')).toBeNull());
});

describe('parseDate', () => {
  it.each([
    ['01/11/2026', '2026-11-01'],
    ['2026-11-01', '2026-11-01'],
    ['20261101120000[-3:BRT]', '2026-11-01'],
    ['05/11/26', '2026-11-05'],
  ])('%s -> %s', (input, iso) => expect(parseDate(input)).toBe(iso));
  it('rejeita data inexistente', () => expect(parseDate('31/02/2026')).toBeNull());
});

describe('OFX', () => {
  it('lê OFX 1.x (SGML)', () => {
    const o = parseOfx(SGML);
    expect(o.rows).toHaveLength(3);
    expect(o.accountId).toBe('12345-6');
    expect(o.rows[0]).toEqual({ date: '2026-11-03', description: 'Compra no débito - PADARIA SÃO JOSÉ', cents: -4590, externalId: 'abc-1' });
    expect(o.rows[1]?.description).toBe('PIX RECEBIDO - Maria Silva');
    expect(o.rows[2]?.description).toBe('CAFE & CIA');
  });
  it('lê OFX 2.x (XML) de cartão', () => {
    expect(parseOfx(XML).rows.map((r) => r.cents)).toEqual([-9999, -1000]);
  });
  it('erro claro quando não há transações', () => {
    expect(() => parseOfx('nada')).toThrow(/Nenhuma transação/);
  });
});

describe('CSV', () => {
  it('Nubank: vírgula, id e aspas', () => {
    const p = prepareCsv(NUBANK);
    expect(p.mapping).toEqual({ date: 0, description: 3, amount: 1, debit: null, credit: null, id: 2 });
    const e = extractCsvRows(p.table, p.headerIndex, p.mapping!);
    expect(e.rows.map((r) => [r.date, r.cents, r.description])).toEqual([
      ['2026-11-03', -4590, 'Padaria, São José'],
      ['2026-11-04', 150000, 'Pix recebido'],
    ]);
  });
  it('banco com preâmbulo, ponto e vírgula e débito/crédito', () => {
    const p = prepareCsv(INTER);
    expect(p.headerIndex).toBe(3);
    expect(p.mapping).toEqual({ date: 0, description: 2, amount: null, debit: 3, credit: 4, id: null });
    const e = extractCsvRows(p.table, p.headerIndex, p.mapping!);
    expect(e.rows.map((r) => r.cents)).toEqual([-12050, 230000, -3500, -3500]);
    expect(e.skipped).toBe(1);
  });
  it('cabeçalho desconhecido pede mapeamento manual', () => {
    expect(prepareCsv('a;b;c\n01/11/2026;x;10,00\n').mapping).toBeNull();
  });
});

describe('hashToUuid', () => {
  it('é determinístico, com formato de UUID e sem colisão em entradas parecidas', () => {
    const a = hashToUuid('h:2026-11-03|-3500|mercado x');
    expect(a).toBe(hashToUuid('h:2026-11-03|-3500|mercado x'));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const set = new Set<string>();
    for (let i = 0; i < 20000; i++) set.add(hashToUuid(`h:2026-11-03|-${i}|mercado x`));
    expect(set.size).toBe(20000);
  });
});

describe('buildReview (anti-duplicidade)', () => {
  const csvRows = (() => {
    const p = prepareCsv(INTER);
    return extractCsvRows(p.table, p.headerIndex, p.mapping!).rows;
  })();
  const asExisting = (rows: ReturnType<typeof buildReview>, n: number): ExistingTx[] =>
    rows.slice(0, n).map((r, i) => ({ id: `e${i}`, date: r.date, kind: r.kind, cents: r.cents, key: r.key }));

  it('tudo novo quando o banco está vazio; idênticas no mesmo arquivo têm chaves diferentes', () => {
    const r = buildReview(csvRows, [], { invert: false });
    expect(r.map((x) => x.status)).toEqual(['new', 'new', 'new', 'new']);
    expect(new Set(r.map((x) => x.key)).size).toBe(4);
    expect(r.map((x) => x.kind)).toEqual(['expense', 'income', 'expense', 'expense']);
  });
  it('reimportar o mesmo arquivo marca como duplicada', () => {
    const first = buildReview(csvRows, [], { invert: false });
    const again = buildReview(csvRows, asExisting(first, 3), { invert: false });
    expect(again.map((x) => x.status)).toEqual(['duplicate', 'duplicate', 'duplicate', 'new']);
    expect(again.map((x) => x.selected)).toEqual([false, false, false, true]);
  });
  it('lançamento manual com 1 dia de diferença vira "possible" e consome só uma linha', () => {
    const manual: ExistingTx[] = [{ id: 'm1', date: '2026-11-03', kind: 'expense', cents: 12050, key: null }];
    expect(buildReview(csvRows, manual, { invert: false }).map((x) => x.status)).toEqual(['possible', 'new', 'new', 'new']);
    const one: ExistingTx[] = [{ id: 'm2', date: '2026-11-03', kind: 'expense', cents: 3500, key: null }];
    expect(buildReview(csvRows, one, { invert: false }).map((x) => x.status)).toEqual(['new', 'new', 'possible', 'new']);
  });
  it('inverter troca entradas e saídas', () => {
    expect(buildReview(csvRows, [], { invert: true }).map((x) => x.kind)).toEqual(['income', 'expense', 'income', 'income']);
  });
  it('OFX reimportado é 100% duplicado', () => {
    const o = parseOfx(SGML);
    const opts = { invert: false, accountId: o.accountId! };
    const first = buildReview(o.rows, [], opts);
    expect(buildReview(o.rows, asExisting(first, 3), opts).map((x) => x.status)).toEqual(['duplicate', 'duplicate', 'duplicate']);
  });
  it('aplica categoria sugerida e forma de pagamento', () => {
    const o = parseOfx(SGML);
    const r = buildReview(o.rows, [], { invert: false, categorize: (d) => (d.includes('PADARIA') ? 'cat-1' : null) });
    expect(r[0]?.categoryId).toBe('cat-1');
    expect(r[0]?.paymentMethod).toBe('debit_card');
    expect(r[1]?.paymentMethod).toBe('pix');
  });
});

describe('guessPayment', () => {
  it('não marca crédito de salário como cartão', () => {
    expect(guessPayment('CREDITO SALARIO', 'income')).toBeNull();
    expect(guessPayment('Pix enviado', 'expense')).toBe('pix');
    expect(guessPayment('Pagamento de boleto', 'expense')).toBe('bank_slip');
  });
});
