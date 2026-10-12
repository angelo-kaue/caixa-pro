import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mapDbError } from '@/services/dbErrors';
import {
  createBill, createBudget, createGoal, createRule, deleteBudget, generateRecurring, getBillsOverview, getMonthlySeries, listBills, listBudgets,
  listGoals, listRules, reopenBill, setRuleActive, settleBill, updateBudget, updateGoal,
} from '@/services/planningService';
import { createTransaction, getSummary, listTransactions } from '@/services/transactionService';
import { closePool, iso, monthStart, setPlan, setup } from './helpers';

afterAll(closePool);

const today = iso(new Date());
const err = async (p: Promise<unknown>) => mapDbError(await p.catch((e: unknown) => e));
const rule = (over = {}) => ({ kind: 'expense' as const, amountCents: 150000, description: 'Aluguel', categoryId: null, paymentMethod: null, dayOfMonth: 1, startOn: monthStart(-2), endOn: null, ...over });

describe('orçamentos', () => {
  it('Free aceita 3 ativos, recusa o 4º e repetidos; Pro libera', async () => {
    const { wsId, cat } = await setup();
    for (const n of ['Alimentação', 'Transporte', 'Lazer']) await createBudget(wsId, cat[n]!, 10000);
    expect(await err(createBudget(wsId, cat['Saúde']!, 10000))).toContain('até 3 orçamentos');
    expect(await err(createBudget(wsId, cat['Lazer']!, 5000))).toContain('Já existe um orçamento');
    expect(await err(createBudget(wsId, cat['Salário']!, 5000))).toContain('categorias de despesa');
    await setPlan(wsId, 'pro');
    await createBudget(wsId, cat['Saúde']!, 10000);
    expect((await listBudgets(wsId)).length).toBe(4);
  });

  it('progresso: o resumo do mês traz o gasto por categoria', async () => {
    const { wsId, cat } = await setup();
    await createBudget(wsId, cat['Alimentação']!, 50000);
    await createTransaction(wsId, { kind: 'expense', amountCents: 12000, description: 'Mercado', categoryId: cat['Alimentação']!, occurredOn: today, paymentMethod: null }, randomUUID());
    const s = await getSummary(wsId, monthStart(), today);
    expect(s.categories.find((c) => c.category_id === cat['Alimentação'])?.total_cents).toBe(12000);
  });

  it('editar, pausar e excluir', async () => {
    const { wsId, cat } = await setup();
    await createBudget(wsId, cat['Lazer']!, 10000);
    const [b] = await listBudgets(wsId);
    await updateBudget(b!.id, { amount_cents: 20000 });
    await updateBudget(b!.id, { active: false });
    expect(await listBudgets(wsId)).toEqual([{ id: b!.id, category_id: cat['Lazer'], amount_cents: 20000, active: false }]);
    await deleteBudget(b!.id);
    expect(await listBudgets(wsId)).toEqual([]);
  });
});

describe('metas e recorrências (Pro)', () => {
  it('Free não cria meta nem recorrência; Pro cria e atualiza', async () => {
    const { wsId } = await setup();
    expect(await err(createGoal(wsId, { name: 'Viagem', targetCents: 100000, targetDate: null }))).toContain('plano Pro');
    expect(await err(createRule(wsId, rule()))).toContain('plano Pro');
    await setPlan(wsId, 'pro');
    await createGoal(wsId, { name: 'Viagem', targetCents: 100000, targetDate: null });
    const [g] = await listGoals(wsId);
    await updateGoal(g!.id, { current_cents: 25000 });
    expect((await listGoals(wsId))[0]).toMatchObject({ name: 'Viagem', target_cents: 100000, current_cents: 25000, target_date: null });
  });

  it('recorrência gera lançamentos uma vez e respeita pausa', async () => {
    const { wsId } = await setup();
    await setPlan(wsId, 'pro');
    await createRule(wsId, rule({ description: 'Aluguel', startOn: monthStart(-2) }));
    expect(await generateRecurring(wsId)).toBe(3);
    expect(await generateRecurring(wsId)).toBe(0);
    const { total } = await listTransactions(wsId, { search: 'Aluguel', from: null, to: null, categoryId: null, kind: null, sort: 'date_desc', page: 1, pageSize: 20 });
    expect(total).toBe(3);
    const [r] = await listRules(wsId);
    await setRuleActive(r!.id, false);
    expect((await listRules(wsId))[0]!.active).toBe(false);
  });

  it('gráficos avançados: série mensal só no Pro', async () => {
    const { wsId } = await setup();
    expect(await err(getMonthlySeries(wsId, 6))).toContain('plano Pro');
    await setPlan(wsId, 'pro');
    await createTransaction(wsId, { kind: 'income', amountCents: 100000, description: 'Salário', categoryId: null, occurredOn: today, paymentMethod: null }, randomUUID());
    const s = await getMonthlySeries(wsId, 3);
    expect(s.length).toBe(3);
    expect(s[2]).toMatchObject({ income_cents: 100000, expense_cents: 0 });
    expect(typeof s[2]!.income_cents).toBe('number');
  });
});

describe('contas a pagar e a receber', () => {
  it('só em espaço de negócio', async () => {
    const { wsId } = await setup('personal');
    expect(await err(createBill(wsId, { kind: 'expense', description: 'Luz', amountCents: 1000, dueOn: today, categoryId: null }))).toContain('negócio');
  });

  it('ciclo completo: criar, visão geral, baixar, desfazer', async () => {
    const { wsId, cat } = await setup('business');
    await createBill(wsId, { kind: 'expense', description: 'Fornecedor X', amountCents: 5000, dueOn: monthStart(-0), categoryId: cat['Fornecedores']! });
    await createBill(wsId, { kind: 'income', description: 'Cliente Y', amountCents: 3000, dueOn: today, categoryId: cat['Vendas']! });
    expect(await getBillsOverview(wsId)).toMatchObject({ payable_cents: 5000, receivable_cents: 3000 });
    const [pay] = (await listBills(wsId, 'pending')).filter((b) => b.kind === 'expense');
    await settleBill(pay!.id, today);
    expect(await getBillsOverview(wsId)).toMatchObject({ payable_cents: 0, receivable_cents: 3000 });
    expect((await listBills(wsId, 'paid'))[0]).toMatchObject({ description: 'Fornecedor X', status: 'paid', paid_on: today });
    const txs = await listTransactions(wsId, { search: 'Fornecedor X', from: null, to: null, categoryId: null, kind: null, sort: 'date_desc', page: 1, pageSize: 5 });
    expect(txs.total).toBe(1);
    expect(await err(settleBill(pay!.id, today))).toContain('já foi baixada');
    await reopenBill(pay!.id);
    expect((await listBills(wsId, 'pending')).length).toBe(2);
    expect((await listTransactions(wsId, { search: 'Fornecedor X', from: null, to: null, categoryId: null, kind: null, sort: 'date_desc', page: 1, pageSize: 5 })).total).toBe(0);
  });
});
