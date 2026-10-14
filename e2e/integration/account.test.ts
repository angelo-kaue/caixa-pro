import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getSupabase } from '@/lib/supabase';
import { exportMyData } from '@/services/accountService';
import { createBudget } from '@/services/planningService';
import { createTransaction } from '@/services/transactionService';
import { saveRule } from '@/services/workspaceService';
import { asAnon, asUser, closePool, iso, setPlan, setup, sql } from './helpers';

afterAll(closePool);
const today = iso(new Date());

describe('LGPD pela API real', () => {
  it('exporta os dados do usuário, com nomes de categoria, e nada de outras pessoas', async () => {
    const a = await setup('personal', 'Espaço da Ana');
    await createTransaction(a.wsId, { kind: 'expense', amountCents: 4200, description: 'Compra exclusiva da Ana', categoryId: a.cat['Lazer']!, occurredOn: today, paymentMethod: 'pix' }, randomUUID());
    await createBudget(a.wsId, a.cat['Lazer']!, 10000);
    await saveRule(a.wsId, 'compra exclusiva', a.cat['Lazer']!);

    const b = await setup('personal', 'Espaço do Beto');
    await createTransaction(b.wsId, { kind: 'expense', amountCents: 100, description: 'Segredo do Beto', categoryId: null, occurredOn: today, paymentMethod: null }, randomUUID());

    asUser(a.userId);
    const data = (await exportMyData()) as Record<string, any>;
    expect(data.workspace.name).toBe('Espaço da Ana');
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0]).toMatchObject({ description: 'Compra exclusiva da Ana', amount_cents: 4200, category: 'Lazer', payment_method: 'pix' });
    expect(data.budgets).toEqual([{ category: 'Lazer', amount_cents: 10000, active: true }]);
    expect(data.classification_rules).toEqual([{ keyword: 'compra exclusiva', category: 'Lazer' }]);
    expect(data.subscription).not.toHaveProperty('provider_subscription_id');
    expect(JSON.stringify(data)).not.toContain('Segredo do Beto');
  });

  it('inclui lançamentos antigos mesmo fora da janela do plano Free (o titular tem direito a tudo)', async () => {
    const a = await setup();
    await setPlan(a.wsId, 'pro'); // o Free recusa datas antigas; o dado nasceu no Pro e depois houve downgrade
    await sql(`insert into public.transactions (workspace_id, kind, amount_cents, description, occurred_on) values ($1, 'expense', 100, 'Muito antigo', current_date - 400)`, [a.wsId]);
    await setPlan(a.wsId, 'free');
    asUser(a.userId);
    const data = (await exportMyData()) as { transactions: { description: string }[] };
    expect(data.transactions.map((t) => t.description)).toContain('Muito antigo');
  });

  it('anônimo não exporta nada', async () => {
    asAnon();
    expect((await getSupabase().rpc('export_my_data')).error).toBeTruthy();
  });
});
