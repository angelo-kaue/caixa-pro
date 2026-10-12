# Cobrança com Mercado Pago

> Os nomes de menus do painel do Mercado Pago e do Supabase mudam com o tempo. Os passos descrevem a intenção;
> confira na documentação oficial (mercadopago.com.br/developers) quando algum nome não bater.

## Como funciona

| Forma | O que é | Renovação |
|---|---|---|
| **Cartão** | Assinatura mensal (API de Assinaturas do Mercado Pago). O cliente autoriza no ambiente do Mercado Pago. | Automática, todo mês. Cancelável no app. |
| **Pix** | Pagamento avulso (Checkout Pro) que libera **30 dias**. | Manual: o cliente paga de novo para continuar. |

Por que o Pix não é recorrente: a assinatura automática do Mercado Pago cobra em cartão. O "Pix Automático" existe,
mas exige habilitação própria da API e não faz parte desta versão.

Fluxo: app → Edge Function `create-checkout` → página do Mercado Pago → **webhook assinado** → `mp-webhook` consulta a
API do Mercado Pago e grava o plano no banco. O navegador nunca concede plano: o front-end só exibe o estado.

- Só o **Pro** pode ser contratado hoje (o servidor recusa outros planos). O Enterprise será vendido quando existir (Fase 5).
- O preço vem da tabela `plans`, nunca do navegador. O webhook confere valor, moeda e referência da compra.
- O CaixaPro não recebe nem guarda dados de cartão.
- Cada pagamento Pix é aplicado uma única vez (idempotência por id do pagamento). Reenvios do webhook são seguros.
- Acesso: `plans`/`subscriptions` + `access_until`. Cartão: próximo vencimento + 3 dias de folga. Se o pagamento deixar
  de chegar, o plano volta ao Free sozinho; os dados são preservados.

## Passo a passo

### 1. Banco
No SQL Editor do Supabase, rode `supabase/migrations/0006_billing.sql`.

### 2. Aplicação no Mercado Pago
1. Entre em *Suas integrações* (painel de desenvolvedores) e crie uma aplicação para **pagamentos online** (Checkout Pro) e **assinaturas**.
2. Anote o **Access Token** de **teste** (depois, o de produção). **Nunca** coloque esse token no front-end nem no GitHub.
3. Crie **usuários de teste** (vendedor e comprador) no painel para testar sem dinheiro real.
4. Em *Webhooks*, configure a URL (uma para teste, outra para produção, se o painel pedir):
   `https://pswtgepgzejneqcnjpcl.supabase.co/functions/v1/mp-webhook`
   Eventos: **Pagamentos** e **Planos e assinaturas** (assinaturas e cobranças de assinatura).
5. Copie a **chave secreta** do webhook (usada para validar a assinatura `x-signature`).

### 3. Edge Functions (Supabase CLI)
```bash
npx supabase login
npx supabase init                      # só se pedir config.toml; não apaga suas migrações
npx supabase link --project-ref pswtgepgzejneqcnjpcl

npx supabase secrets set \
  MP_ACCESS_TOKEN="<token de teste>" \
  MP_WEBHOOK_SECRET="<chave secreta do webhook>" \
  APP_URL="https://SEU-SITE.netlify.app" \
  MP_SANDBOX=true

npx supabase functions deploy mp-webhook --no-verify-jwt   # o Mercado Pago não envia JWT
npx supabase functions deploy create-checkout
npx supabase functions deploy cancel-subscription
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente das funções. A `service_role`
fica só lá.

`APP_URL` deve ser o endereço público (https) do app: o Mercado Pago volta o cliente para `APP_URL/app/plano` e pode
recusar `http://localhost`. Para testar localmente, use o app já hospedado ou um túnel https. Aceita várias origens separadas por vírgula (a primeira é usada no retorno).

### 4. Ligar no front-end
Defina `VITE_BILLING_ENABLED=true` (no `.env.local` e nas variáveis da Netlify) e refaça o build. Enquanto estiver
`false`, a interface informa que a contratação ainda não está disponível.

### 5. Testar (sandbox)
- Em `/app/plano`, **Assinar no cartão** com o usuário comprador de teste e um cartão de teste do Mercado Pago. Ao voltar, a tela
  confirma o plano (pode levar alguns segundos).
- **Pagar 30 dias com Pix** e conclua o pagamento de teste.
- **Cancelar assinatura**: o plano segue até o fim do período pago.
- Conferir: painel do Mercado Pago (histórico de notificações), *Logs* das funções no Supabase e, no SQL Editor,
  `select * from payment_events order by id desc limit 20;`
- Webhook com assinatura inválida deve responder 401.

### 6. Produção
1. Troque `MP_ACCESS_TOKEN` pelo de **produção**, `MP_SANDBOX=false`, e configure a URL/chave do webhook de produção.
2. Faça uma compra real de baixo valor e um estorno de teste.
3. Revise com um contador/advogado: tributação da receita recorrente, política de cancelamento e reembolso (o Código de
   Defesa do Consumidor prevê direito de arrependimento em compras online) e os textos de Termos e Privacidade.

## CPF (sem CNPJ)
O Mercado Pago permite abrir conta com CPF e, segundo o próprio material do Mercado Pago, receber por Pix e cobranças
online. **Não consegui confirmar** em documentação oficial se as credenciais de produção da API de Assinaturas funcionam
para conta pessoa física: confirme no painel (ou com o suporte) antes de contar com isso. Receber de forma recorrente como pessoa física
tem implicações fiscais; converse com um contador (abrir MEI costuma ser simples e barato).

## O que NÃO foi testado contra o Mercado Pago real
Eu não tenho acesso à API do Mercado Pago a partir do ambiente de desenvolvimento. Foram testados (com dublês): a validação da
assinatura, as regras de decisão, o fluxo completo do webhook, o cliente HTTP, o banco e o webhook rodando de verdade
(sem rede). **Confira no primeiro teste real**:
- os nomes dos eventos que o painel envia (`payment`, `subscription_preapproval`, `subscription_authorized_payment`);
- se a assinatura criada devolve `init_point` e, depois de autorizada, traz `next_payment_date` e `external_reference`;
- se o Checkout Pro mostra Pix para a sua conta (a conta precisa ter Pix habilitado).

## Limites desta versão
- Estorno ou chargeback de Pix não revoga o acesso automaticamente (vale até `access_until`). Revogação manual abaixo.
- Sem cobrança proporcional: trocar de forma de pagamento encerra a assinatura anterior e começa um novo período.
- Enterprise não é vendido.
- Sem rotina de reconciliação periódica: se um webhook se perder definitivamente, o estado se corrige no próximo evento.

## Operações manuais (SQL Editor, como administrador)
```sql
-- Conceder 30 dias de Pro (cortesia). A chave evita aplicar duas vezes.
select public.grant_paid_period('<workspace_id>', 'pro', 30, 'cortesia-001', 'pix', true);

-- Revogar acesso pago imediatamente
update public.subscriptions set plan_id = 'free', status = 'active', access_until = null, billing_mode = null
 where workspace_id = '<workspace_id>';

-- Ver os eventos recebidos
select * from public.payment_events order by id desc limit 50;
```
