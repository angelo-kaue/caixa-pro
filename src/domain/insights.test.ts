import { describe, expect, it } from 'vitest';
import { generateInsights, type InsightInput } from './insights';

const base: InsightInput = {
  current: { incomeCents: 300000, expenseCents: 100000 },
  previous: { incomeCents: 300000, expenseCents: 100000 },
  categories: [],
  previousCategories: [],
  budgets: [],
};
const ids = (i: InsightInput) => generateInsights(i).map((x) => x.id);

describe('generateInsights', () => {
  it('sem movimentação não gera nada', () => {
    expect(generateInsights({ ...base, current: { incomeCents: 0, expenseCents: 0 } })).toEqual([]);
  });

  it('resultado positivo gera o percentual guardado', () => {
    const r = generateInsights(base);
    expect(r.map((x) => x.id)).toContain('savings');
    expect(r.find((x) => x.id === 'savings')?.text).toContain('67%');
  });

  it('despesa maior que receita avisa', () => {
    const r = generateInsights({ ...base, current: { incomeCents: 100000, expenseCents: 150000 } });
    expect(r[0]?.id).toBe('negative-result');
    expect(r[0]?.text).toContain('R$ 500,00');
  });

  it('variação de despesas só aparece a partir de 10%', () => {
    expect(ids({ ...base, current: { incomeCents: 300000, expenseCents: 105000 } })).not.toContain('expense-change');
    const up = generateInsights({ ...base, current: { incomeCents: 300000, expenseCents: 150000 } }).find((x) => x.id === 'expense-change');
    expect(up?.tone).toBe('warn');
    expect(up?.text).toContain('subiram 50%');
    const down = generateInsights({ ...base, current: { incomeCents: 300000, expenseCents: 50000 } }).find((x) => x.id === 'expense-change');
    expect(down?.tone).toBe('good');
    expect(down?.text).toContain('caíram 50%');
  });

  it('maior categoria e categoria que mais subiu', () => {
    const r = generateInsights({
      ...base,
      categories: [
        { name: 'Alimentação', kind: 'expense', totalCents: 60000 },
        { name: 'Transporte', kind: 'expense', totalCents: 40000 },
      ],
      previousCategories: [{ name: 'Transporte', kind: 'expense', totalCents: 20000 }],
    });
    expect(r.find((x) => x.id === 'top-category')?.text).toContain('Alimentação');
    expect(r.find((x) => x.id === 'top-category')?.text).toContain('60%');
    expect(r.find((x) => x.id === 'category-up')?.text).toContain('Transporte subiram 100%');
  });

  it('orçamentos estourados vêm primeiro; 80% avisa', () => {
    const r = generateInsights({
      ...base,
      budgets: [
        { categoryName: 'Lazer', limitCents: 10000, spentCents: 12000 },
        { categoryName: 'Saúde', limitCents: 10000, spentCents: 8500 },
        { categoryName: 'Moradia', limitCents: 10000, spentCents: 2000 },
      ],
    });
    expect(r[0]?.id).toBe('budget-over-Lazer');
    expect(r.map((x) => x.id)).toContain('budget-near-Saúde');
    expect(r.map((x) => x.id)).not.toContain('budget-near-Moradia');
  });

  it('limita a quantidade', () => {
    expect(generateInsights(base, 1).length).toBeLessThanOrEqual(1);
  });
});
