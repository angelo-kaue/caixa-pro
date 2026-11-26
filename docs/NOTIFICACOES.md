# Lembretes por notificação (Web Push)

Até 3 avisos por dia (12:30, 18:30 e 21:00, horário de Brasília) para registrar gastos. Só recebe quem ainda **não lançou nada no dia**.
Cada pessoa liga em **Minha conta > Lembretes** (ou pelo convite no Resumo), aparelho por aparelho.

## Como funciona
- O app registra o aparelho (`push_subscriptions`, só por funções do banco; o navegador não lê a tabela).
- O Supabase agenda (pg_cron) uma chamada à função `send-reminders` nos 3 horários.
- A função escolhe quem não lançou hoje, criptografa a mensagem (RFC 8291) e envia pelo serviço de push do navegador, assinando com a chave VAPID.
- Aparelhos que cancelaram (404/410) ou falharam 5 vezes seguidas são removidos sozinhos.

## Configuração (uma vez só)
1. **Gerar as chaves VAPID:** `npx web-push generate-vapid-keys`. Guarde as duas. A privada **nunca** vai para o repositório nem para a Netlify.
2. **Rodar a migração** `supabase/migrations/0010_push_reminders.sql` no SQL Editor (depois `supabase/diagnostico.sql` deve mostrar a 0010 como OK).
3. **Segredos do Supabase** (troque os valores):
   ```
   npx supabase secrets set VAPID_PUBLIC_KEY=<chave pública> VAPID_PRIVATE_KEY=<chave privada> VAPID_SUBJECT=mailto:seu@email.com REMINDER_CRON_SECRET=<um texto aleatório longo>
   ```
   Para gerar o texto aleatório no PowerShell: `[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')`
4. **Publicar a função:** `npx supabase functions deploy send-reminders --no-verify-jwt`
5. **Netlify:** variável `VITE_VAPID_PUBLIC_KEY=<chave pública>` e depois Deploys > Trigger deploy > Clear cache and deploy site.
6. **Agendar:** abra `supabase/cron-lembretes.sql`, troque `PROJECT_REF` e `SEGREDO` (o mesmo `REMINDER_CRON_SECRET`), cole no SQL Editor e rode. Não commite esse arquivo preenchido.
7. **Testar:** no site, Minha conta > Lembretes > Ativar lembretes > Enviar teste.

## Observações
- **iPhone:** só recebe se o CaixaPro estiver instalado na tela de início (iOS 16.4 ou mais novo). No Safari comum não funciona.
- O service worker só roda no site publicado, não no `npm run dev`.
- Mudar o horário: rode `select cron.unschedule(jobname) from cron.job where jobname like 'caixapro-%';` e agende de novo com outros horários (lembre que o cron usa UTC; Brasília = UTC-3).
- Ver se os envios estão acontecendo: `select jobname, status, start_time from cron.job_run_details d join cron.job j using (jobid) order by start_time desc limit 10;` e os logs da função `send-reminders` no painel do Supabase.
