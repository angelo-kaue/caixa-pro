# Testes

| Camada | Comando | O que cobre | Precisa de |
|---|---|---|---|
| Tipos | `npm run build` (inclui `tsc` do app e das funções) | erros de TypeScript | só Node |
| Unitários | `npm test` | regras de negócio, parser, CSV, insights, cobrança (assinatura do webhook, decisões, fluxo com dublês), landing | só Node |
| Banco | `npm run test:db` | migrações, RLS, limites do Free, recursos Pro, cobrança | Postgres local (`psql`) |
| Integração | `npm run test:integration` | os serviços do app contra Postgres + PostgREST reais (RLS de verdade, formatos de erro, escalada de privilégio) | Postgres local + binário do PostgREST (`POSTGREST_BIN`) |
| Navegador | `npm run test:browser` | telas em celular e desktop com dados reais: erros de console, rolagem horizontal, acessibilidade (axe), fluxos e capturas de tela | integração acima + `puppeteer-core`, `@sparticuz/chromium`, `axe-core` instalados (veja o topo de `e2e/browser/run.mjs`) |

Nada disso toca o seu projeto Supabase: tudo roda em um banco local descartável.

## Integração e navegador (como foi rodado)

```bash
export PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=postgres
export POSTGREST_BIN=/caminho/para/postgrest      # https://github.com/PostgREST/postgrest/releases
npm run test:integration
```

Para o navegador: gere um build apontando para o backend local, suba o PostgREST, o proxy `e2e/support/fake-supabase.mjs`
e o `vite preview`, rode `e2e/browser/seed.mjs` e depois `e2e/browser/run.mjs`. As capturas de tela vão para `/tmp/shots`.

## O que os testes automáticos NÃO cobrem
- O Mercado Pago real (use as contas de teste: `docs/BILLING.md`).
- E-mails de confirmação e recuperação de senha do Supabase Auth.
- Celulares e navegadores reais (Safari do iPhone, em especial) e a instalação do PWA.
