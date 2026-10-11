import { describe, expect, it } from 'vitest';
import { parseQuickEntry } from './parser';

const today = '2026-10-10';
const parse = (s: string, userRules: { keyword: string; category: string }[] = []) =>
  parseQuickEntry(s, { today, userRules });

describe('exemplos do produto', () => {
  it('"50 Uber" → despesa de transporte, sem confirmação', () => {
    expect(parse('50 Uber')).toMatchObject({
      amountCents: 5000, kind: 'expense', description: 'Uber', categoryName: 'Transporte',
      occurredOn: today, needsConfirmation: false,
    });
  });

  it('"32,90 iFood" → alimentação, mas pede confirmação', () => {
    const r = parse('32,90 iFood');
    expect(r).toMatchObject({ amountCents: 3290, kind: 'expense', description: 'iFood', categoryName: 'Alimentação' });
    expect(r.needsConfirmation).toBe(true);
  });

  it('"Recebi 2500 de salário" → receita de salário', () => {
    expect(parse('Recebi 2500 de salário')).toMatchObject({
      amountCents: 250000, kind: 'income', description: 'Salário', categoryName: 'Salário', needsConfirmation: false,
    });
  });

  it('"Mercado 186,40" → alimentação', () => {
    expect(parse('Mercado 186,40')).toMatchObject({
      amountCents: 18640, kind: 'expense', description: 'Mercado', categoryName: 'Alimentação', needsConfirmation: false,
    });
  });

  it('"Conta de internet 99,90" → contas e serviços', () => {
    expect(parse('Conta de internet 99,90')).toMatchObject({
      amountCents: 9990, kind: 'expense', description: 'Conta de internet', categoryName: 'Contas e serviços', needsConfirmation: false,
    });
  });

  it('"Venda de produto 350 reais" → receita de vendas', () => {
    expect(parse('Venda de produto 350 reais')).toMatchObject({
      amountCents: 35000, kind: 'income', description: 'Venda de produto', categoryName: 'Vendas', needsConfirmation: false,
    });
  });
});

describe('valores', () => {
  it('formatos brasileiros', () => {
    expect(parse('R$ 1.234,56 aluguel')).toMatchObject({ amountCents: 123456, description: 'Aluguel', categoryName: 'Moradia' });
    expect(parse('aluguel 1.500')).toMatchObject({ amountCents: 150000 });
    expect(parse('lanche 18.50').amountCents).toBe(1850);
  });

  it('número colado em letras não vira valor ("99pop")', () => {
    expect(parse('99pop 18,50')).toMatchObject({ amountCents: 1850, description: '99pop', categoryName: 'Transporte' });
  });

  it('sem valor → amountCents nulo', () => {
    expect(parse('Uber').amountCents).toBeNull();
    expect(parse('').amountCents).toBeNull();
    expect(parse('   ').amountCents).toBeNull();
    expect(parse('Uber 0').amountCents).toBeNull();
  });

  it('vários números → escolhe o mais plausível e pede confirmação', () => {
    const r = parse('Pizza 2 sabores 60');
    expect(r.amountCents).toBe(6000);
    expect(r.needsConfirmation).toBe(true);
  });

  it('um valor marcado com R$ vence números soltos sem pedir confirmação', () => {
    const r = parse('2 pizzas R$ 60');
    expect(r.amountCents).toBe(6000);
    expect(r.reasons).not.toContain('Encontrei mais de um número: confira o valor.');
  });
});

describe('datas', () => {
  it('ontem, hoje e anteontem', () => {
    expect(parse('Uber 50 ontem').occurredOn).toBe('2026-10-09');
    expect(parse('Uber 50 anteontem').occurredOn).toBe('2026-10-08');
    expect(parse('Uber 50 hoje').occurredOn).toBe(today);
  });

  it('dd/mm no início ou no fim', () => {
    expect(parse('05/10 Uber 20')).toMatchObject({ occurredOn: '2026-10-05', amountCents: 2000 });
    expect(parse('Uber 20 05/10/2026').occurredOn).toBe('2026-10-05');
  });

  it('dd/mm de data futura assume o ano passado e pede confirmação', () => {
    const r = parse('Uber 20 25/12');
    expect(r.occurredOn).toBe('2025-12-25');
    expect(r.needsConfirmation).toBe(true);
  });

  it('"dia N"', () => {
    expect(parse('Almoço 35 dia 5')).toMatchObject({ occurredOn: '2026-10-05', needsConfirmation: false });
    const r = parse('Almoço 35 dia 25');
    expect(r.occurredOn).toBe('2026-09-25');
    expect(r.needsConfirmation).toBe(true);
  });

  it('data inexistente é ignorada (31/02)', () => {
    expect(parse('Uber 20 31/02').occurredOn).toBe(today);
  });
});

describe('forma de pagamento', () => {
  it('detecta e remove da descrição', () => {
    expect(parse('Farmácia 45,90 no pix')).toMatchObject({ paymentMethod: 'pix', description: 'Farmácia', categoryName: 'Saúde' });
    expect(parse('Netflix 55,90 cartão de crédito')).toMatchObject({ paymentMethod: 'credit_card', description: 'Netflix', categoryName: 'Lazer' });
    expect(parse('Mercado 80 débito').paymentMethod).toBe('debit_card');
    expect(parse('Padaria 12 dinheiro').paymentMethod).toBe('cash');
  });

  it('"Pix 50" mantém Pix como descrição', () => {
    expect(parse('Pix 50')).toMatchObject({ paymentMethod: 'pix', description: 'Pix' });
  });
});

describe('tipo (receita/despesa)', () => {
  it('verbos fortes decidem', () => {
    expect(parse('Paguei 80 internet').kind).toBe('expense');
    expect(parse('Vendi 200 bolo')).toMatchObject({ kind: 'income', categoryName: 'Vendas' });
    expect(parse('Pix recebido de João 200').kind).toBe('income');
  });

  it('sinais conflitantes pedem confirmação', () => {
    const r = parse('Pagamento salário 3000');
    expect(r.kind).toBe('expense');
    expect(r.needsConfirmation).toBe(true);
  });
});

describe('categoria', () => {
  it('sem regra → categoria nula e pede confirmação', () => {
    const r = parse('Xpto 30');
    expect(r.categoryName).toBeNull();
    expect(r.needsConfirmation).toBe(true);
  });

  it('preferência do usuário vence a regra padrão', () => {
    const r = parse('Padaria 12', [{ keyword: 'padaria', category: 'Lazer' }]);
    expect(r.categoryName).toBe('Lazer');
    expect(r.needsConfirmation).toBe(false);
  });

  it('"mercado livre" é compra, não alimentação', () => {
    expect(parse('Mercado Livre 120').categoryName).toBe('Compras');
  });

  it('categorias de negócio', () => {
    expect(parse('Fornecedor 900').categoryName).toBe('Fornecedores');
    expect(parse('Google Ads 300').categoryName).toBe('Marketing');
  });
});

describe('frases do dia a dia', () => {
  it('R$ colado ao número e valor no fim', () => {
    expect(parse('R$50 mercado')).toMatchObject({ amountCents: 5000, description: 'Mercado', categoryName: 'Alimentação' });
    expect(parse('mercado R$ 186,40')).toMatchObject({ amountCents: 18640, description: 'Mercado' });
  });
  it('salário sem acento e sem verbo', () => {
    expect(parse('2500 salario')).toMatchObject({ amountCents: 250000, kind: 'income', categoryName: 'Salário' });
  });
  it('gasolina com data e pagamento juntos', () => {
    expect(parse('Gasolina 200 ontem no débito')).toMatchObject({
      amountCents: 20000, description: 'Gasolina', categoryName: 'Transporte', occurredOn: '2026-10-09', paymentMethod: 'debit_card',
    });
  });
  it('descrição nunca fica vazia', () => {
    expect(parse('R$ 30').description).not.toBe('');
    expect(parse('Recebi 100')).toMatchObject({ kind: 'income', amountCents: 10000 });
  });
});
