-- CaixaPro 0006: cobrança (Mercado Pago). Nenhum privilégio de assinante é concedido pelo front-end:
-- só o backend (service_role, via Edge Functions) chama as funções de concessão abaixo.

alter table public.subscriptions
  add column access_until timestamptz,
  add column billing_mode text check (billing_mode is null or billing_mode in ('card', 'pix'));

-- Plano efetivo agora considera o fim do período pago:
--  * active/trialing: vale enquanto não passar de access_until (null = sem prazo, ex.: ajuste manual);
--  * past_due/canceled: só valem enquanto houver período pago restante (carência / cancelamento no fim do ciclo).
create or replace function public.workspace_plan(p_workspace uuid) returns public.plan_id
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.plan_id from public.subscriptions s
      where s.workspace_id = p_workspace
        and (
          (s.status in ('active', 'trialing') and (s.access_until is null or s.access_until > now()))
          or (s.status in ('past_due', 'canceled') and s.access_until is not null and s.access_until > now())
        )),
    'free'::public.plan_id
  );
$$;

-- Intenção de compra criada no servidor; o webhook só confia em external_reference que exista aqui.
create table public.billing_checkouts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  plan_id public.plan_id not null check (plan_id <> 'free'),
  mode text not null check (mode in ('card', 'pix')),
  created_by uuid references auth.users (id) on delete set null,
  provider_ref text,
  created_at timestamptz not null default now()
);
create index billing_checkouts_ws_idx on public.billing_checkouts (workspace_id, created_at desc);

-- Histórico de eventos do provedor + trava de idempotência (event_key único).
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_key text not null,
  topic text,
  resource_id text,
  outcome text,
  created_at timestamptz not null default now(),
  unique (provider, event_key)
);

alter table public.billing_checkouts enable row level security;
alter table public.payment_events enable row level security;
revoke all on public.billing_checkouts, public.payment_events from anon, authenticated;

-- Registra um evento. Retorna true se for novo, false se já havia sido registrado.
create function public.record_payment_event(p_provider text, p_event_key text, p_topic text, p_resource_id text, p_outcome text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.payment_events (provider, event_key, topic, resource_id, outcome)
  values (p_provider, p_event_key, p_topic, p_resource_id, p_outcome)
  on conflict (provider, event_key) do nothing;
  return found;
end;
$$;

-- Concede um período pago (Pix ou cobrança de cartão), uma única vez por p_event_key.
-- p_stack: soma ao período restante quando é o mesmo plano ainda válido (renovação antecipada de Pix).
create function public.grant_paid_period(
  p_workspace uuid, p_plan public.plan_id, p_days integer, p_event_key text,
  p_mode text, p_stack boolean, p_provider_ref text default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  s public.subscriptions;
  v_base timestamptz;
begin
  if p_plan = 'free' or p_days is null or p_days < 1 or p_days > 400 or p_mode not in ('card', 'pix') then
    raise exception 'INVALID_GRANT';
  end if;

  insert into public.payment_events (provider, event_key, topic, resource_id, outcome)
  values ('mercadopago', 'applied:' || p_event_key, 'grant', p_event_key, 'granted')
  on conflict (provider, event_key) do nothing;
  if not found then
    return false;
  end if;

  select * into s from public.subscriptions where workspace_id = p_workspace for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if p_stack and s.plan_id = p_plan and s.status in ('active', 'trialing') and s.access_until is not null and s.access_until > now() then
    v_base := s.access_until;
  else
    v_base := now();
  end if;

  update public.subscriptions
     set plan_id = p_plan,
         status = 'active',
         access_until = v_base + make_interval(days => p_days),
         cancel_at_period_end = false,
         billing_mode = p_mode,
         provider = 'mercadopago',
         provider_subscription_id = coalesce(p_provider_ref, provider_subscription_id)
   where workspace_id = p_workspace;
  return true;
end;
$$;

-- Aplica o estado de uma assinatura recorrente (reconciliado a partir da API do provedor).
create function public.apply_subscription_update(
  p_workspace uuid, p_plan public.plan_id, p_status public.subscription_status, p_access_until timestamptz,
  p_cancel_at_period_end boolean, p_provider_subscription_id text, p_mode text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_mode not in ('card', 'pix') then
    raise exception 'INVALID_GRANT';
  end if;
  update public.subscriptions
     set plan_id = p_plan,
         status = p_status,
         access_until = p_access_until,
         cancel_at_period_end = p_cancel_at_period_end,
         billing_mode = p_mode,
         provider = 'mercadopago',
         provider_subscription_id = p_provider_subscription_id
   where workspace_id = p_workspace;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.record_payment_event(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.grant_paid_period(uuid, public.plan_id, integer, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.apply_subscription_update(uuid, public.plan_id, public.subscription_status, timestamptz, boolean, text, text) from public, anon, authenticated;
grant execute on function public.record_payment_event(text, text, text, text, text) to service_role;
grant execute on function public.grant_paid_period(uuid, public.plan_id, integer, text, text, boolean, text) to service_role;
grant execute on function public.apply_subscription_update(uuid, public.plan_id, public.subscription_status, timestamptz, boolean, text, text) to service_role;
