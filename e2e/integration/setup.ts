import { vi } from 'vitest';

// Todos os serviços do app chamam getSupabase(): aqui devolvemos o cliente do "usuário atual" do teste.
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => {
    const c = (globalThis as { __current?: unknown }).__current;
    if (!c) throw new Error('Nenhum usuário definido no teste: chame asUser() ou asAnon().');
    return c;
  },
}));
