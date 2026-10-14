-- CaixaPro 0008: ao pagar por Pix, a referência da assinatura de cartão anterior é limpa.
-- Sem isso, um evento antigo do cartão (ex.: cancelamento) sobrescrevia o estado do plano pago por Pix.

create or replace function public.grant_paid_period(
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
         -- Pagamento por Pix encerra o vínculo com qualquer assinatura de cartão anterior.
         provider_subscription_id = case when p_mode = 'pix' then null else coalesce(p_provider_ref, provider_subscription_id) end
   where workspace_id = p_workspace;
  return true;
end;
$$;
