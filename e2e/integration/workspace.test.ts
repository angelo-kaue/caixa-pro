import { afterAll, describe, expect, it } from 'vitest';
import { mapDbError } from '@/services/dbErrors';
import { getSubscription } from '@/services/billingService';
import { createWorkspace, getMyWorkspace, getWorkspacePlan, listCategories, listRules, saveRule } from '@/services/workspaceService';
import { asAnon, asUser, closePool, newUser, setup } from './helpers';

afterAll(closePool);

describe('espaço de trabalho (serviços reais + RLS)', () => {
  it('cria, lê e vem com categorias padrão e plano Free', async () => {
    const u = await newUser();
    asUser(u);
    const id = await createWorkspace('business', 'Loja X', 150000);
    expect(await getMyWorkspace()).toMatchObject({ id, type: 'business', name: 'Loja X', initial_balance_cents: 150000 });
    expect((await listCategories(id)).length).toBe(15);
    expect(await getWorkspacePlan(id)).toBe('free');
    expect(await getSubscription(id)).toMatchObject({ plan_id: 'free', status: 'active', billing_mode: null, access_until: null });
  });

  it('espaço pessoal tem 12 categorias', async () => {
    const { wsId } = await setup('personal');
    expect((await listCategories(wsId)).length).toBe(12);
  });

  it('segundo espaço é recusado com mensagem clara', async () => {
    await setup();
    const err = await createWorkspace('personal', 'Outro', 0).catch((e: unknown) => e);
    expect(mapDbError(err)).toContain('já tem um espaço');
  });

  it('nome vazio e saldo fora do limite são recusados', async () => {
    const u = await newUser();
    asUser(u);
    expect(mapDbError(await createWorkspace('personal', '   ', 0).catch((e: unknown) => e))).toContain('nome');
    expect(mapDbError(await createWorkspace('personal', 'X', 100_000_000_000).catch((e: unknown) => e))).toContain('saldo');
  });

  it('preferência de categoria: o upsert atualiza em vez de duplicar', async () => {
    const { wsId, cat } = await setup();
    await saveRule(wsId, 'padaria do joao', cat['Alimentação']!);
    await saveRule(wsId, 'padaria do joao', cat['Lazer']!);
    const rules = await listRules(wsId);
    expect(rules).toEqual([{ keyword: 'padaria do joao', category_id: cat['Lazer'] }]);
  });

  it('usuário anônimo não acessa nada', async () => {
    asAnon();
    await expect(getMyWorkspace()).rejects.toBeTruthy();
  });
});
