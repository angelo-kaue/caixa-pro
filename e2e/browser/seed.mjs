// Cria usuários e dados realistas no banco de teste para os testes de navegador.
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import pg from 'pg';

const client = new pg.Client({ host: '127.0.0.1', user: 'postgres', password: 'postgres', database: process.env.E2E_DB ?? 'caixapro_e2e' });
await client.connect();

async function asUser(uid, fn) {
  await client.query('begin');
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid })]);
  try {
    await fn();
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  }
}

async function makeUser(label) {
  const id = randomUUID();
  await client.query('insert into auth.users (id, email) values ($1, $2)', [id, `${label}@teste.local`]);
  return id;
}

async function seedWorkspace(uid, type, name, balance, txs, plan = 'free') {
  let wsId;
  await asUser(uid, async () => {
    wsId = (await client.query('select public.create_workspace($1::public.workspace_type, $2, $3) as id', [type, name, balance])).rows[0].id;
    if (plan !== 'free') await client.query(`update public.subscriptions set plan_id = $2, status = 'active', access_until = null where workspace_id = $1`, [wsId, plan]);
    const cats = Object.fromEntries((await client.query('select id, name from public.categories where workspace_id = $1', [wsId])).rows.map((r) => [r.name, r.id]));
    for (const [kind, cents, desc, cat, daysAgo] of txs) {
      await client.query(
        `insert into public.transactions (workspace_id, kind, amount_cents, description, category_id, occurred_on)
         values ($1, $2, $3, $4, $5, current_date - $6::int)`,
        [wsId, kind, cents, desc, cat ? cats[cat] : null, daysAgo],
      );
    }
  });
  return wsId;
}

const free = await makeUser('free');
const pro = await makeUser('pro');
const empty = await makeUser('vazio');

const freeTxs = [
  ['income', 450000, 'Salário', 'Salário', 3],
  ['expense', 18640, 'Mercado', 'Alimentação', 2],
  ['expense', 5000, 'Uber', 'Transporte', 1],
  ['expense', 9990, 'Conta de internet', 'Contas e serviços', 5],
  ['expense', 3290, 'iFood', 'Alimentação', 4],
  ['expense', 12000, 'Farmácia', 'Saúde', 6],
  ['expense', 4500, 'Cinema', 'Lazer', 7],
  ['expense', 150000, 'Aluguel', 'Moradia', 8],
  ['expense', 7000, 'Uber', 'Transporte', 35],
  ['expense', 21000, 'Mercado', 'Alimentação', 40],
  ['income', 450000, 'Salário', 'Salário', 33],
];
const freeWs = await seedWorkspace(free, 'personal', 'Minhas finanças', 100000, freeTxs);
await client.query(`insert into public.budgets (workspace_id, category_id, amount_cents) select $1, id, 60000 from public.categories where workspace_id = $1 and name = 'Alimentação'`, [freeWs]);

const proTxs = [];
for (let m = 0; m < 6; m++) {
  proTxs.push(['income', 900000 + m * 20000, 'Vendas do mês', 'Vendas', m * 30 + 4]);
  proTxs.push(['expense', 250000 + m * 15000, 'Fornecedor', 'Fornecedores', m * 30 + 6]);
  proTxs.push(['expense', 40000 + m * 3000, 'Anúncios', 'Marketing', m * 30 + 9]);
}
const proWs = await seedWorkspace(pro, 'business', 'Loja da Maria', 500000, proTxs, 'pro');
await client.query(`update public.subscriptions set billing_mode = 'pix', access_until = now() + interval '20 days' where workspace_id = $1`, [proWs]);
await client.query(
  `insert into public.bills (workspace_id, kind, description, amount_cents, due_on)
   values ($1, 'expense', 'Fornecedor ABC', 320000, current_date - 3), ($1, 'income', 'Cliente Silva', 150000, current_date + 5), ($1, 'expense', 'Aluguel da loja', 180000, current_date + 10)`,
  [proWs],
);
await client.query(`insert into public.goals (workspace_id, name, target_cents, current_cents, target_date) values ($1, 'Reserva de emergência', 3000000, 1250000, current_date + 240)`, [proWs]);

writeFileSync('/tmp/e2e-users.json', JSON.stringify({ free, pro, empty }));
console.log('seed ok', { free, pro, empty });
await client.end();
