-- Agenda os lembretes diários (horário de Brasília): 12:30, 18:30 e 21:00. Rode UMA vez no SQL Editor do Supabase.
-- Antes de rodar, troque PROJECT_REF (o código do projeto, que aparece na URL do Supabase) e SEGREDO (o mesmo valor
-- de REMINDER_CRON_SECRET). NÃO commite este arquivo com os valores preenchidos.
-- Os horários abaixo estão em UTC (Brasília = UTC-3): 15:30, 21:30 e 00:00.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('caixapro-lembrete-meio-dia', '30 15 * * *', $job$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'SEGREDO'),
    body := '{"slot":"noon"}'::jsonb
  );
$job$);

select cron.schedule('caixapro-lembrete-fim-de-tarde', '30 21 * * *', $job$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'SEGREDO'),
    body := '{"slot":"evening"}'::jsonb
  );
$job$);

select cron.schedule('caixapro-lembrete-noite', '0 0 * * *', $job$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'SEGREDO'),
    body := '{"slot":"night"}'::jsonb
  );
$job$);

-- Conferir os agendamentos:      select jobid, jobname, schedule, active from cron.job where jobname like 'caixapro-%';
-- Ver as últimas execuções:      select jobname, status, start_time from cron.job_run_details d join cron.job j using (jobid) order by start_time desc limit 10;
-- Pausar tudo:                   select cron.unschedule(jobname) from cron.job where jobname like 'caixapro-%';
