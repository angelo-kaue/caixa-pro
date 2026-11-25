import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewRow } from '@/domain/statement/types';

type Payload = { occurred_on: string; description: string; idempotency_key: string };
let handler: (rows: Payload[]) => { message?: string; code?: string } | null;
const calls: Payload[][] = [];

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: () => ({
      insert: (payload: Payload | Payload[]) => {
        const list = Array.isArray(payload) ? payload : [payload];
        calls.push(list);
        return Promise.resolve({ error: handler(list) });
      },
    }),
  }),
}));

const { importTransactions } = await import('./statementService');

const row = (i: number, date: string): ReviewRow => ({
  id: String(i),
  date,
  description: `item ${i}`,
  kind: 'expense',
  cents: 1000 + i,
  key: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  status: 'new',
  selected: true,
  categoryId: null,
  paymentMethod: null,
});

beforeEach(() => {
  calls.length = 0;
});

describe('importTransactions', () => {
  it('grava tudo em um lote quando não há erro', async () => {
    handler = () => null;
    const rows = Array.from({ length: 150 }, (_, i) => row(i, '2026-11-03'));
    const r = await importTransactions('ws', rows);
    expect(r).toMatchObject({ inserted: 150, duplicates: 0, monthlyBlocked: 0, failed: 0 });
    expect(calls.map((c) => c.length)).toEqual([100, 50]);
  });

  it('limite mensal do Free: salva o que couber e para de tentar naquele mês', async () => {
    let saved = 0;
    handler = (rows) => {
      if (rows.length > 1 || saved >= 3) return { message: 'MONTHLY_LIMIT_REACHED' };
      saved++;
      return null;
    };
    const rows = Array.from({ length: 10 }, (_, i) => row(i, '2026-11-03'));
    const r = await importTransactions('ws', rows);
    expect(r.inserted).toBe(3);
    expect(r.monthlyBlocked).toBe(7);
    // 1 lote + 3 ok + 1 recusada; as outras 6 nem foram tentadas
    expect(calls.length).toBe(1 + 3 + 1);
  });

  it('meses diferentes são independentes', async () => {
    handler = (rows) => {
      if (rows.length > 1) return { message: 'MONTHLY_LIMIT_REACHED' };
      return rows[0]?.occurred_on.startsWith('2026-10') ? { message: 'MONTHLY_LIMIT_REACHED' } : null;
    };
    const rows = [row(0, '2026-10-05'), row(1, '2026-11-05'), row(2, '2026-10-20')];
    const r = await importTransactions('ws', rows);
    expect(r).toMatchObject({ inserted: 1, monthlyBlocked: 2 });
  });

  it('chave repetida (23505) conta como duplicada e não derruba o resto', async () => {
    handler = (rows) => {
      if (rows.length > 1) return { code: '23505' };
      return rows[0]?.description === 'item 1' ? { code: '23505' } : null;
    };
    const r = await importTransactions('ws', [row(0, '2026-11-01'), row(1, '2026-11-02'), row(2, '2026-11-03')]);
    expect(r).toMatchObject({ inserted: 2, duplicates: 1, failed: 0 });
  });

  it('histórico do Free: datas mais antigas que a recusada são puladas', async () => {
    handler = (rows) => {
      if (rows.length > 1) return { message: 'HISTORY_LIMIT' };
      return (rows[0]?.occurred_on ?? '') < '2026-09-01' ? { message: 'HISTORY_LIMIT' } : null;
    };
    const rows = [row(0, '2026-10-01'), row(1, '2026-08-15'), row(2, '2026-07-01'), row(3, '2026-11-01')];
    const r = await importTransactions('ws', rows);
    expect(r).toMatchObject({ inserted: 2, historyBlocked: 2 });
    expect(calls.length).toBe(1 + 3); // lote + 0 + 1 recusada (08-15) + 3; 07-01 pulada sem tentar
  });

  it('erros inesperados: mensagem em português e desiste após 5 seguidos', async () => {
    handler = () => ({ message: 'boom' });
    const rows = Array.from({ length: 12 }, (_, i) => row(i, '2026-11-03'));
    const r = await importTransactions('ws', rows);
    expect(r.inserted).toBe(0);
    expect(r.failed).toBe(12);
    expect(r.firstError).toMatch(/Algo deu errado/);
    expect(calls.length).toBe(1 + 5);
  });

  it('descrição é limitada a 140 caracteres', async () => {
    handler = () => null;
    const long = { ...row(0, '2026-11-03'), description: 'x'.repeat(300) };
    await importTransactions('ws', [long]);
    expect(calls[0]?.[0]?.description.length).toBe(140);
  });
});
