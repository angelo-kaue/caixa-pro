# CaixaPro

SaaS de controle financeiro para pessoas físicas, autônomos e pequenos negócios.
Stack: React + TypeScript (estrito) + Vite + Tailwind + React Router + Supabase (Auth, PostgreSQL, RLS).

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
```

Em desenvolvimento, `/sistema-de-design` mostra os tokens e componentes base (não existe no build de produção).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | checagem de tipos + build de produção em `dist/` |
| `npm test` | testes unitários e de renderização (Vitest) |
| `npm run typecheck` | só a checagem de tipos |
| `npm run typecheck:functions` | checa os tipos do código compartilhado das Edge Functions |
| `npm run test:integration` | serviços do app contra Postgres + PostgREST reais (veja `docs/TESTING.md`) |
| `npm run test:browser` | telas em celular/desktop, acessibilidade e fluxos (veja `docs/TESTING.md`) |
| `npm run test:db` | aplica as migrações em um Postgres local descartável e roda os testes de RLS/limites (precisa de `psql` e de um Postgres local) |

## Estrutura

```
src/config/plans.ts        catálogo único de planos, preços e limites (front)
src/domain/money.ts        dinheiro em centavos: parse BR, formatação, validação
src/features/landing/      landing page
src/domain/parser.ts       registro inteligente (valor, tipo, data, pagamento, categoria por regras)
src/features/auth/         Supabase Auth: provider, guards, schemas, serviços
src/features/workspace/    espaço de trabalho, categorias e regras do usuário (provider)
src/features/transactions/ lançamento rápido, formulário, histórico
src/features/dashboard/    resumo financeiro com dados reais
src/services/              acesso ao Supabase (única camada que fala com o banco)
src/features/pwa/          orientação de instalação (iOS Safari e navegadores compatíveis)
src/components/ui/         design system (botão, campos, tabela, alerta, etc.)
supabase/migrations/       SQL versionado (schema, funções/triggers, RLS)
supabase/tests/            testes de isolamento e limites do plano
public/                    manifest, service worker, ícones
```

## Banco de dados e segurança

- Toda tabela tem RLS ligado e privilégios mínimos para `authenticated`; `anon` não acessa nada.
- Espaço de trabalho criado só por `create_workspace()` (atômico: espaço, vínculo de administrador, assinatura Free e categorias padrão).
- Limites do Free (100 lançamentos/mês por mês do lançamento, janela de histórico de 3 meses, 3 orçamentos ativos) e recursos do Pro (metas, recorrências, gráficos avançados) são aplicados por trigger, RLS e funções no banco.
- Os gatilhos de limite checam a associação ao espaço antes de qualquer regra, para não vazar informação de outros espaços.
- `subscriptions` e `workspace_members` são somente leitura para o cliente; a escrita será feita pelo backend (Fase 4/5).
- A chave `service_role` nunca vai para o front-end nem para o repositório.

Setup do Supabase e deploy: veja [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Status

Fases 1 a 4 implementadas. A cobrança (Mercado Pago: cartão em assinatura mensal e Pix de 30 dias) está pronta no código, mas **desligada** (`VITE_BILLING_ENABLED=false`) até você configurar as credenciais: veja `docs/BILLING.md`. Próximo: Fase 5 (Enterprise: equipes, papéis, unidades, auditoria).
A cobrança nunca foi testada contra o Mercado Pago real (veja `docs/BILLING.md`).
