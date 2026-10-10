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
| `npm run test:db` | aplica as migrações em um Postgres local descartável e roda os testes de RLS/limites (precisa de `psql` e de um Postgres local) |

## Estrutura

```
src/config/plans.ts        catálogo único de planos, preços e limites (front)
src/domain/money.ts        dinheiro em centavos: parse BR, formatação, validação
src/features/landing/      landing page
src/features/auth/         Supabase Auth: provider, guards, schemas, serviços
src/features/pwa/          orientação de instalação (iOS Safari e navegadores compatíveis)
src/components/ui/         design system (botão, campos, tabela, alerta, etc.)
supabase/migrations/       SQL versionado (schema, funções/triggers, RLS)
supabase/tests/            testes de isolamento e limites do plano
public/                    manifest, service worker, ícones
```

## Banco de dados e segurança

- Toda tabela tem RLS ligado e privilégios mínimos para `authenticated`; `anon` não acessa nada.
- Espaço de trabalho criado só por `create_workspace()` (atômico: espaço, vínculo de administrador, assinatura Free e categorias padrão).
- Limites do Free (100 lançamentos/mês por mês do lançamento, janela de histórico de 3 meses) são aplicados por trigger e RLS no banco.
- `subscriptions` e `workspace_members` são somente leitura para o cliente; a escrita será feita pelo backend (Fase 4/5).
- A chave `service_role` nunca vai para o front-end nem para o repositório.

Setup do Supabase e deploy: veja [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Status

Fase 1 (fundação, landing page, banco e autenticação) concluída. Próximo: Fase 2 (espaço de trabalho, lançamentos, histórico, dashboard).
Pagamentos reais **não** estão implementados.
