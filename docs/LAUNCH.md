# Checklist de lançamento do CaixaPro

Faça **uma etapa por vez** e só passe para a seguinte quando a anterior estiver certa.
Os nomes de menus dos painéis (Supabase, Netlify, Mercado Pago) mudam com o tempo: o que importa é a intenção.

---

## Etapa 1. Conferir o aviso automático do Mercado Pago (webhook)

Por que importa: sem ele, quem paga e fecha a aba antes de voltar ao CaixaPro só recebe o plano se voltar depois e clicar em "Já paguei: verificar agora".

1. Faça uma compra de teste (Pix ou cartão) e **espere 1 minuto**.
2. No Supabase, abra **SQL Editor**, rode e leia o resultado:
   ```sql
   select id, topic, outcome, created_at from payment_events order by id desc limit 10;
   ```
3. Como ler:
   - **Aparecem linhas** com `topic` como `payment` ou `subscription_preapproval`: o webhook funciona. Etapa concluída.
   - **Não aparece nada:** abra **Edge Functions**, depois **mp-webhook**, depois **Logs**.
     - Sem nenhuma chamada: o Mercado Pago não está avisando. Confira, no painel do Mercado Pago (aplicação da conta **vendedora de teste**, menu **Webhooks**), se a URL é `https://pswtgepgzejneqcnjpcl.supabase.co/functions/v1/mp-webhook` e se os eventos **Pagamentos** e **Planos e assinaturas** estão marcados.
     - Aparece "assinatura inválida": a chave secreta guardada está errada. Copie de novo a chave **da mesma aplicação** e rode:
       ```
       npx supabase secrets set MP_WEBHOOK_SECRET="CHAVE"
       npx supabase functions deploy mp-webhook --no-verify-jwt
       ```
     - Aparece "sem data.id": me mande a linha completa do log.

---

## Etapa 2. Seus dados nos textos legais

1. Abra `src\config\legal.ts`.
2. Troque `[NOME COMPLETO DO RESPONSÁVEL]` e `[E-MAIL DE CONTATO]` pelos seus dados reais (use um e-mail que você realmente leia).
3. Leve os textos (`/termos` e `/privacidade`, no site) a um advogado. Peça atenção a: política de cancelamento e reembolso, limitação de responsabilidade, e regras para quem opera como pessoa física.
4. Só depois da revisão, mude `reviewed: false` para `reviewed: true` no mesmo arquivo (isso tira o aviso "versão preliminar").
5. `git add -A`, `git commit -m "Dados legais"`, `git push`.

---

## Etapa 3. Supabase em produção

1. **Authentication → URL Configuration**
   - *Site URL*: o endereço final do site (por exemplo `https://caixapro.netlify.app` ou o seu domínio).
   - *Redirect URLs*: adicione `https://SEU-ENDERECO/**`. Pode manter o de `localhost` para desenvolvimento.
2. **Authentication → Providers → Email**: deixe **Confirm email** ligado e a **senha mínima em 8**.
3. **E-mails:** o envio padrão do Supabase tem limite muito baixo por hora e serve só para testes. Configure um **SMTP próprio** (em *Authentication*, configurações de SMTP) com um serviço de e-mail (por exemplo Resend, Brevo ou Amazon SES). Depois faça um cadastro de teste e confira que o e-mail chega, inclusive o de recuperação de senha.
4. **Backups:** veja, no seu plano do Supabase, se existem backups automáticos e por quantos dias. Se não existirem, antes de ter clientes baixe um backup manual de tempos em tempos.
5. **Mensagens de e-mail:** em *Authentication → Email Templates*, confira que os textos estão em português e fazem sentido.

---

## Etapa 4. Netlify

1. **Site configuration → Environment variables**: confirme `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_BILLING_ENABLED=true`.
2. **Domain management:** se tiver domínio próprio, adicione-o e siga as instruções de DNS. O HTTPS é emitido sozinho.
3. Depois de definir o endereço final, volte à Etapa 3 (Site URL) e à Etapa 5 (`APP_URL`).

---

## Etapa 5. Trocar o Mercado Pago de teste para o real

Faça isto **por último**, com tudo acima funcionando.

1. **Conta real:** confirme que a sua conta do Mercado Pago está verificada e pode receber (dados pessoais, conta bancária). **Confirme com o suporte do Mercado Pago** se a API de Assinaturas está liberada para conta de pessoa física (CPF): não consegui verificar isso em documentação oficial.
2. No painel de desenvolvedores, **conta real** (não a de teste): crie uma aplicação com Checkout Pro e Assinaturas e copie o **Access Token de produção**.
3. Configure o webhook dessa aplicação de produção, com a mesma URL da Etapa 1 e os mesmos eventos. Copie a **chave secreta de produção**.
4. No terminal:
   ```
   npx supabase secrets set MP_ACCESS_TOKEN="TOKEN_DE_PRODUCAO" MP_WEBHOOK_SECRET="CHAVE_DE_PRODUCAO" MP_SANDBOX=false APP_URL="https://ENDERECO_FINAL"
   npx supabase secrets unset MP_TEST_PAYER_EMAIL
   npx supabase functions deploy create-checkout
   npx supabase functions deploy sync-billing
   npx supabase functions deploy cancel-subscription
   npx supabase functions deploy delete-account
   npx supabase functions deploy mp-webhook --no-verify-jwt
   ```
5. **Teste com dinheiro de verdade, valor baixo.** No SQL Editor, tente primeiro R$ 1,00:
   ```sql
   update plans set price_cents = 100 where id = 'pro';
   ```
   Se o Mercado Pago recusar o valor (assinatura e Pix podem ter mínimos diferentes), use R$ 5,00 (`price_cents = 500`).
   Faça **uma** compra no cartão e **uma** no Pix, pagando com um cartão e uma conta **de outra pessoa** (familiar ou amigo): o Mercado Pago não deixa a mesma pessoa/conta pagar a si mesma. Confirme que o plano muda para Pro.
6. **Volte o preço (não esqueça):**
   ```sql
   update plans set price_cents = 1990 where id = 'pro';
   ```
7. No painel do Mercado Pago, **estorne** as compras de teste. Estorno de Pix **não** tira o Pro automaticamente: se precisar, revogue com
   ```sql
   update subscriptions set plan_id = 'free', status = 'active', access_until = null, billing_mode = null where workspace_id = 'ID_DO_ESPACO';
   ```
8. Cancele a assinatura de teste pelo botão do app e confirme que o status muda.

---

## Etapa 6. Roteiro final com uma conta nova (10 minutos)

Em janela anônima, como se fosse um cliente:
1. Entrar na página inicial e ler os textos.
2. Criar conta e **receber o e-mail** de confirmação; clicar no link.
3. Configurar o espaço (pessoal ou negócio).
4. Registrar `50 Uber`, depois `Recebi 2500 de salário`, depois `32,90 iFood`.
5. Ver o Resumo e o histórico; editar e excluir um lançamento.
6. Criar um orçamento.
7. Pedir recuperação de senha e redefinir a senha.
8. Abrir o site **no celular** (Safari do iPhone, se possível), conferir o layout e o aviso para adicionar à tela inicial.
9. Em **Minha conta**, baixar os dados.
10. Criar outra conta só para testar **Excluir minha conta**.

---

## Pendências conhecidas (anote, não bloqueiam o início)
- Duas vulnerabilidades de nível moderado no roteador (`react-router`): exigem atualização para a versão 7. Reavaliar depois do lançamento; o CaixaPro não usa os recursos afetados.
- O Enterprise não é vendido (a Fase 5 ainda não foi feita).
- Estorno de Pix não revoga o plano sozinho.
- O `npm run build` falha no seu Windows por um bloqueio do próprio Windows; a Netlify compila normalmente.
- Sem monitoramento automático: olhe os **Logs** das funções e a tabela `payment_events` nos primeiros dias.

## Depois de abrir
1. Nos primeiros 7 dias, olhe os logs das funções todos os dias.
2. Confira se o e-mail de contato recebe mensagens (e responda).
3. Anote os pedidos dos primeiros clientes antes de construir o Enterprise.
