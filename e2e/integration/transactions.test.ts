import { afterAll, describe, expect, it } from 'vitest';
import { parseQuickEntry } from '@/domain/parser';
import { mapDbError } from '@/services/dbErrors';
import {
  countTransactionsBetween, createTransaction, deleteTransaction, getSummary, hasSimilarTransaction, listTransactions, updateTransaction,
  type TxFilters, type TxInput,
} from '@/services/transactionService';
import { asUser, closePool, iso, monthStart, newUser, setup, sql } from './helpers';
import { createWorkspace } from '@/services/workspaceService';
import { randomUUID } from 'node:crypto';

afterAll(closePool);

const today = iso(new Date());
const filters = (over: Partial<TxFilters> = {}): TxFilters => ({ search: '', from: null, to: null, categoryId: null, kind: null, sort: 'date_desc', page: 1, pageSize: 20, ...over });
const tx = (over: Partial<TxInput> = {}): TxInput => ({ kind: 'expense', amountCents: 5000, description: 'Uber', categoryId: null, occurredOn: today, paymentMethod: null, ...over });
const err = async (p: Promise<unknown>) => mapDbError(await p.catch((e: unknown) => e));

describe('lançamentos (serviços reais + PostgREST)', () => {
  it('fluxo do registro inteligente: interpreta, grava e lê de volta', async () => {
    const { wsId, cat } = await setup();
    const p = parseQuickEntry('50 Uber ontem no pix', { today, userRules: [] });
    await createTransaction(wsId, { kind: p.kind, amountCents: p.amountCents!, description: p.description, categoryId: cat[p.categoryName!] ?? null, occurredOn: p.occurredOn, paymentMethod: p.paymentMethod }, randomUUID());
    const { rows, total } = await listTransactions(wsId, filters());
    expect(total).toBe(1);
    expect(rows[0]).toMatchObject({ kind: 'expense', amount_cents: 5000, description: 'Uber', category_id: cat['Transporte'], payment_method: 'pix' });
    expect(typeof rows[0]!.amount_cents).toBe('number');
  });

  it('busca é literal (%, _) e não diferencia maiúsculas', async () => {
    const { wsId } = await setup();
    for (const d of ['Desconto 10%', 'Desconto 10x', 'Taxa_boleto', 'Taxa boleto']) await createTransaction(wsId, tx({ description: d }), randomUUID());
    const s = async (q: string) => (await listTransactions(wsId, filters({ search: q }))).rows.map((r) => r.description).sort();
    expect(await s('10%')).toEqual(['Desconto 10%']);
    expect(await s('taxa_b')).toEqual(['Taxa_boleto']);
    expect(await s('DESCONTO')).toEqual(['Desconto 10%', 'Desconto 10x']);
  });

  it('filtros de tipo, categoria e data', async () => {
    const { wsId, cat } = await setup();
    await createTransaction(wsId, tx({ description: 'A', categoryId: cat['Transporte']!, occurredOn: monthStart() }), randomUUID());
    await createTransaction(wsId, tx({ description: 'B', kind: 'income', categoryId: cat['Salário']!, occurredOn: today }), randomUUID());
    await createTransaction(wsId, tx({ description: 'C', occurredOn: monthStart(-1) }), randomUUID());
    const d = async (f: Partial<TxFilters>) => (await listTransactions(wsId, filters(f))).rows.map((r) => r.description).sort();
    expect(await d({ kind: 'income' })).toEqual(['B']);
    expect(await d({ categoryId: cat['Transporte']! })).toEqual(['A']);
    expect(await d({ from: monthStart(), to: today })).toEqual(['A', 'B']);
    expect(await d({ to: monthStart(-1) })).toEqual(['C']);
  });

  it('paginação e ordenação com contagem total', async () => {
    const { wsId } = await setup();
    await sql(`insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on)
               select $1, 'expense', g * 100, 'item ' || g, current_date from generate_series(1, 25) g`, [wsId]);
    const p1 = await listTransactions(wsId, filters({ pageSize: 10, sort: 'amount_desc' }));
    const p3 = await listTransactions(wsId, filters({ pageSize: 10, page: 3, sort: 'amount_desc' }));
    expect(p1.total).toBe(25);
    expect(p1.rows.map((r) => r.amount_cents)).toEqual([2500, 2400, 2300, 2200, 2100, 2000, 1900, 1800, 1700, 1600]);
    expect(p3.rows.map((r) => r.amount_cents)).toEqual([500, 400, 300, 200, 100]);
    expect((await listTransactions(wsId, filters({ sort: 'amount_asc', pageSize: 3 }))).rows.map((r) => r.amount_cents)).toEqual([100, 200, 300]);
  });

  it('editar, excluir e detectar lançamento idêntico', async () => {
    const { wsId, cat } = await setup();
    await createTransaction(wsId, tx(), randomUUID());
    expect(await hasSimilarTransaction(wsId, tx())).toBe(true);
    expect(await hasSimilarTransaction(wsId, tx({ amountCents: 1 }))).toBe(false);
    const [row] = (await listTransactions(wsId, filters())).rows;
    await updateTransaction(row!.id, tx({ amountCents: 7700, description: 'Uber editado', categoryId: cat['Transporte']! }));
    expect((await listTransactions(wsId, filters())).rows[0]).toMatchObject({ amount_cents: 7700, description: 'Uber editado' });
    await deleteTransaction(row!.id);
    expect((await listTransactions(wsId, filters())).total).toBe(0);
  });

  it('mesma chave de idempotência não grava duas vezes', async () => {
    const { wsId } = await setup();
    const key = randomUUID();
    await createTransaction(wsId, tx(), key);
    expect(await err(createTransaction(wsId, tx(), key))).toContain('já foi registrado');
    expect((await listTransactions(wsId, filters())).total).toBe(1);
  });

  it('valores inválidos são recusados pelo banco', async () => {
    const { wsId } = await setup();
    expect(await err(createTransaction(wsId, tx({ amountCents: 0 }), randomUUID()))).toContain('inválido');
    expect(await err(createTransaction(wsId, tx({ amountCents: -5 }), randomUUID()))).toContain('inválido');
    expect(await err(createTransaction(wsId, tx({ description: '   ' }), randomUUID()))).toContain('inválido');
  });

  it('limite do Free: o 101º lançamento do mês é recusado com a mensagem do plano', async () => {
    const { wsId } = await setup();
    await sql(`insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on)
               select $1, 'expense', 100, 'lote ' || g, date_trunc('month', current_date)::date from generate_series(1, 100) g`, [wsId]);
    expect(await countTransactionsBetween(wsId, monthStart(), today)).toBe(100);
    expect(await err(createTransaction(wsId, tx({ occurredOn: monthStart() }), randomUUID()))).toContain('limite de 100');
  });

  it('janela de histórico do Free: data de 4 meses atrás é recusada', async () => {
    const { wsId } = await setup();
    expect(await err(createTransaction(wsId, tx({ occurredOn: monthStart(-4) }), randomUUID()))).toContain('últimos 3 meses');
    await createTransaction(wsId, tx({ occurredOn: monthStart(-2) }), randomUUID());
  });

  it('categoria de outro espaço é recusada', async () => {
    const a = await setup();
    const b = await setup();
    asUser(b.userId);
    expect(await err(createTransaction(b.wsId, tx({ categoryId: a.cat['Transporte']! }), randomUUID()))).toContain('categoria');
  });

  it('resumo do período e saldo', async () => {
    const u = await newUser();
    asUser(u);
    const wsId = await createWorkspace('personal', 'Resumo', 100000);
    await createTransaction(wsId, tx({ kind: 'income', amountCents: 50000, description: 'Salário' }), randomUUID());
    await createTransaction(wsId, tx({ amountCents: 6500, description: 'Mercado' }), randomUUID());
    const s = await getSummary(wsId, monthStart(), today);
    expect(s).toMatchObject({ balance_cents: 100000 + 50000 - 6500, income_cents: 50000, expense_cents: 6500 });
    expect(s.categories.reduce((a, c) => a + c.total_cents, 0)).toBe(56500);
    expect(typeof s.balance_cents).toBe('number');
    expect(await err(getSummary(wsId, today, monthStart(-1)))).toContain('período');
  });
});
