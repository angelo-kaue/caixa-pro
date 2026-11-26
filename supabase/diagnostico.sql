-- CaixaPro: diagnóstico de migrações. Cole no SQL Editor do Supabase e clique em Run. Só lê; não altera nada.
-- Cada linha mostra se uma migração parece aplicada (procura objetos que ela cria).
with fn as (
  select p.proname, p.prosrc
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select m.migracao, case when m.aplicada then 'OK' else 'FALTA RODAR' end as situacao
from (values
  ('0001_core_schema', to_regclass('public.transactions') is not null and to_regclass('public.workspaces') is not null and to_regclass('public.plans') is not null),
  ('0002_functions_and_triggers', exists (select 1 from fn where proname = 'create_workspace')),
  ('0003_rls_policies', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'transactions' and policyname = 'transactions_select')),
  ('0004_workspace_summary', exists (select 1 from fn where proname = 'workspace_summary')),
  ('0005_planning_features', to_regclass('public.bills') is not null and exists (select 1 from fn where proname = 'monthly_series')),
  ('0006_billing', to_regclass('public.payment_events') is not null and exists (select 1 from fn where proname = 'grant_paid_period')),
  ('0007_lgpd', exists (select 1 from fn where proname = 'export_my_data')),
  ('0008_pix_clears_card_ref', exists (select 1 from fn where proname = 'grant_paid_period' and prosrc like '%p_mode = ''pix'' then null%')),
  ('0009_edit_initial_balance', exists (select 1 from fn where proname = 'set_initial_balance')),
  ('0010_push_reminders', to_regclass('public.push_subscriptions') is not null and exists (select 1 from fn where proname = 'reminder_targets'))
) as m(migracao, aplicada)
order by m.migracao;
