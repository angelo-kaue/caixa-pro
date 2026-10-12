import { createClient } from '@supabase/supabase-js';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import { createWorkspace } from '@/services/workspaceService';
import { listCategories } from '@/services/workspaceService';
import type { WorkspaceType } from '@/types/db';

const SECRET = process.env.E2E_JWT_SECRET ?? 'segredo-de-teste-com-mais-de-32-caracteres!!';
const URL = 'http://127.0.0.1:54321';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function makeJwt(sub: string): string {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ sub, role: 'authenticated', aud: 'authenticated', email: `${sub}@teste.local`, exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export function asUser(id: string): void {
  (globalThis as { __current?: unknown }).__current = createClient(URL, 'anon-key', { ...opts, global: { headers: { Authorization: `Bearer ${makeJwt(id)}` } } });
}

export function asAnon(): void {
  (globalThis as { __current?: unknown }).__current = createClient(URL, 'anon-key', opts);
}

const pool = new pg.Pool({ host: '127.0.0.1', user: 'postgres', password: 'postgres', database: process.env.E2E_DB ?? 'caixapro_e2e' });

export const sql = (text: string, params?: unknown[]) => pool.query(text, params);
export const closePool = () => pool.end();

export async function newUser(): Promise<string> {
  const id = randomUUID();
  await sql('insert into auth.users (id, email) values ($1, $2)', [id, `${id}@teste.local`]);
  return id;
}

/** Simula o backend (service_role): ajusta o plano de um espaço. */
export async function setPlan(workspaceId: string, plan: 'free' | 'pro' | 'enterprise'): Promise<void> {
  await sql(`update public.subscriptions set plan_id = $2, status = 'active', access_until = null where workspace_id = $1`, [workspaceId, plan]);
}

export interface Ctx {
  userId: string;
  wsId: string;
  /** nome -> id das categorias do espaço (despesa e receita têm nomes distintos nos padrões). */
  cat: Record<string, string>;
}

export async function setup(type: WorkspaceType = 'personal', name = 'Espaço de teste'): Promise<Ctx> {
  const userId = await newUser();
  asUser(userId);
  const wsId = await createWorkspace(type, name, 0);
  const cats = await listCategories(wsId);
  return { userId, wsId, cat: Object.fromEntries(cats.map((c) => [c.name, c.id])) };
}

export const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const monthStart = (offset = 0): string => {
  const n = new Date();
  return iso(new Date(n.getFullYear(), n.getMonth() + offset, 1));
};
