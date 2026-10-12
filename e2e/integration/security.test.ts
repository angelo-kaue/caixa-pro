import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getSupabase } from '@/lib/supabase';
import { mapDbError } from '@/services/dbErrors';
import { createBudget, createGoal, createRule, getBillsOverview, listBudgets, listGoals, settleBill } from '@/services/planningService';
import { createTransaction, deleteTransaction, getSummary, listTransactions, updateTransaction } from '@/services/transactionService';
import { getMyWorkspace, listCategories } from '@/services/workspaceService';
import { asAnon, asUser, closePool, iso, monthStart, setPlan, setup, sql } from './helpers';

afterAll(closePool);
const today = iso(new Date());
const all = { search: '', from: null, to: null, categoryId: null, kind: null, sort: 'date_desc' as const, page: 1, pageSize: 50 };
const tx = { kind: 'expense' as const, amountCents: 100, description: 'x', categoryId: null, occurredOn: today, paymentMethod: null };

describe('isolamento entre usuários (pela API de verdade)', () => {
  it('B não enxerga, não altera e não apaga dados de A', async () => {
    const a = await setup('business');
    await setPlan(a.wsId, 'pro');
    await createTransaction(a.wsId, { ...tx, description: 'segredo de A', amountCents: 99999 }, randomUUID());
    await createBudget(a.wsId, a.cat['Lazer']!, 1000);
    await createGoal(a.wsId, { name: 'Meta de A', targetCents: 1000, targetDate: null });
    const [row] = (await listTransactions(a.wsId, all)).rows;

    const b = await setup('personal');
    asUser(b.userId);
    expect((await getMyWorkspace())?.id).toBe(b.wsId);
    expect((await listTransactions(a.wsId, all)).total).toBe(0);
    expect(await listBudgets(a.wsId)).toEqual([]);
    expect(await listGoals(a.wsId)).toEqual([]);
    expect(await listCategories(a.wsId)).toEqual([]);
    await expect(updateTransaction(row!.id, tx)).rejects.toMatchObject({ message: 'FORBIDDEN' });
    await expect(deleteTransaction(row!.id)).rejects.toMatchObject({ message: 'FORBIDDEN' });
    expect(mapDbError(await createTransaction(a.wsId, tx, randomUUID()).catch((e: unknown) => e))).toContain('permissão');
    expect(mapDbError(await getSummary(a.wsId, monthStart(), today).catch((e: unknown) => e))).toContain('permissão');
    expect(mapDbError(await getBillsOverview(a.wsId).catch((e: unknown) => e))).toContain('permissão');
    expect(mapDbError(await createRule(a.wsId, { kind: 'expense', amountCents: 1, description: 'x', categoryId: null, paymentMethod: null, dayOfMonth: 1, startOn: today, endOn: null }).catch((e: unknown) => e))).toContain('permissão');

    asUser(a.userId);
    expect((await listTransactions(a.wsId, all)).total).toBe(1);
    expect((await listTransactions(a.wsId, all)).rows[0]!.description).toBe('segredo de A');
  });

  it('B não consegue baixar a conta de A', async () => {
    const a = await setup('business');
    await sql(`insert into public.bills (workspace_id, kind, description, amount_cents, due_on) values ($1, 'expense', 'Conta de A', 100, current_date)`, [a.wsId]);
    const { rows } = await sql('select id from public.bills where workspace_id = $1', [a.wsId]);
    const b = await setup();
    asUser(b.userId);
    expect(mapDbError(await settleBill(rows[0].id, today).catch((e: unknown) => e))).toContain('permissão');
  });
});

describe('escalada de privilégios pelo cliente', () => {
  it('o usuário não consegue mudar o próprio plano nem a assinatura', async () => {
    const a = await setup();
    const sb = getSupabase();
    const up = await sb.from('subscriptions').update({ plan_id: 'enterprise' }).eq('workspace_id', a.wsId).select();
    expect(up.error).toBeTruthy();
    const up2 = await sb.from('subscriptions').update({ access_until: '2099-01-01T00:00:00Z' }).eq('workspace_id', a.wsId).select();
    expect(up2.error).toBeTruthy();
    const ins = await sb.from('subscriptions').insert({ workspace_id: a.wsId, plan_id: 'pro' });
    expect(ins.error).toBeTruthy();
    const { rows } = await sql('select plan_id from public.subscriptions where workspace_id = $1', [a.wsId]);
    expect(rows[0].plan_id).toBe('free');
  });

  it('funções de cobrança e tabelas internas não são acessíveis ao usuário', async () => {
    const a = await setup();
    const sb = getSupabase();
    const grant = await sb.rpc('grant_paid_period', { p_workspace: a.wsId, p_plan: 'pro', p_days: 30, p_event_key: 'hack', p_mode: 'pix', p_stack: true });
    expect(grant.error).toBeTruthy();
    expect((await sb.rpc('apply_subscription_update', { p_workspace: a.wsId, p_plan: 'pro', p_status: 'active', p_access_until: null, p_cancel_at_period_end: false, p_provider_subscription_id: 'x', p_mode: 'card' })).error).toBeTruthy();
    expect((await sb.from('payment_events').select('*')).error).toBeTruthy();
    expect((await sb.from('billing_checkouts').select('*')).error).toBeTruthy();
    expect((await sb.from('recurring_runs').select('*')).error).toBeTruthy();
    expect((await sb.from('workspace_members').insert({ workspace_id: a.wsId, user_id: a.userId, role: 'admin' })).error).toBeTruthy();
    const { rows } = await sql('select plan_id from public.subscriptions where workspace_id = $1', [a.wsId]);
    expect(rows[0].plan_id).toBe('free');
  });

  it('anônimo não acessa tabelas nem funções', async () => {
    const a = await setup();
    asAnon();
    const sb = getSupabase();
    expect((await sb.from('transactions').select('id')).error).toBeTruthy();
    expect((await sb.from('plans').select('id')).error).toBeTruthy();
    expect((await sb.rpc('create_workspace', { p_type: 'personal', p_name: 'x', p_initial_balance_cents: 0 })).error).toBeTruthy();
    expect((await sb.rpc('workspace_summary', { p_workspace: a.wsId, p_from: monthStart(), p_to: today })).error).toBeTruthy();
  });

  it('JWT com assinatura inválida é recusado', async () => {
    const a = await setup();
    const forged = (await import('@supabase/supabase-js')).createClient('http://127.0.0.1:54321', 'anon-key', {
      global: { headers: { Authorization: `Bearer ${(await import('./helpers')).makeJwt(a.userId).slice(0, -3)}abc` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const r = await forged.from('transactions').select('id');
    expect(r.error).toBeTruthy();
  });
});
