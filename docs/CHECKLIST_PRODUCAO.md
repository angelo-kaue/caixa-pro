# Checklist de produção (rode antes de cada atualização importante)

## 1. Banco (Supabase)
1. SQL Editor > cole `supabase/diagnostico.sql` > Run. Todas as linhas devem dizer **OK**.
2. Para cada linha **FALTA RODAR**: abra `supabase/migrations/<arquivo>.sql`, cole no SQL Editor e rode **uma por vez, em ordem numérica**.
3. Rode o diagnóstico de novo até tudo ficar **OK**.

## 2. Edge Functions (só precisa de deploy se o código delas mudou)
Funções: `create-checkout`, `sync-billing`, `cancel-subscription`, `mp-webhook` (com `--no-verify-jwt`), `delete-account`, `send-reminders` (com `--no-verify-jwt`).
Segredos que devem existir em produção (`npx supabase secrets list` mostra só os nomes):
- `MP_ACCESS_TOKEN` (de **produção**), `MP_WEBHOOK_SECRET`, `APP_URL` (https, sem `/` no final)
- `MP_SANDBOX=false`; `MP_TEST_PAYER_EMAIL` apagado; `CARD_ENABLED=false` enquanto o cartão estiver desligado
- Lembretes: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `REMINDER_CRON_SECRET` (passo a passo em `docs/NOTIFICACOES.md`)

## 3. Netlify (Site configuration > Environment variables)
- `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- `VITE_BILLING_ENABLED=true` (sem isso a página de plano diz que a contratação não está disponível)
- `VITE_CARD_ENABLED=false` enquanto o cartão estiver desligado
- `VITE_VAPID_PUBLIC_KEY` (chave pública dos lembretes; sem ela a seção "Lembretes" não aparece)
Depois de mudar qualquer variável: Deploys > Trigger deploy > **Clear cache and deploy site** (variáveis `VITE_` entram no build).

## 4. Teste rápido depois do deploy (2 minutos, Ctrl+F5 antes)
- Entrar, abrir o painel e criar um lançamento.
- Lançamentos > Importar extrato (um CSV pequeno) e apagar os de teste.
- Minha conta > Saldo inicial: alterar e conferir que o saldo do painel muda.
- Plano e cobrança: aparece o botão de Pix (sem o aviso de "não disponível").
- Minha conta > Lembretes: ativar e usar "Enviar teste" (no celular, com o app instalado).
- Tocar no nome "CaixaPro" no topo leva ao Resumo; no celular, tocar num campo não dá zoom.
- Abrir no celular instalado (PWA) e repetir o login.

## 5. Beta fechado
- O Pro liberado por SQL vence em datas diferentes por conta; confira a coluna `access_until` em `subscriptions` antes de acabar.
