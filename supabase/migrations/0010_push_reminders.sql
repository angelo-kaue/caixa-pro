-- CaixaPro 0010: lembretes por notificação (Web Push).
-- Cada aparelho que ativa os lembretes vira uma linha em push_subscriptions. O navegador não lê nem altera a
-- tabela diretamente: só pelas funções abaixo. O envio é feito pela Edge Function send-reminders (service_role).

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 1000),
  p256dh text not null check (char_length(p256dh) between 40 and 200),
  auth_key text not null check (char_length(auth_key) between 10 and 100),
  user_agent text check (char_length(user_agent) <= 300),
  failures integer not null default 0,
  last_success_at timestamptz,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
-- Para saber rápido quem já lançou algo hoje.
create index if not exists transactions_created_by_created_at_idx on public.transactions (created_by, created_at desc);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Salva (ou transfere para o usuário atual) a inscrição deste aparelho. Mantém no máximo 10 aparelhos por usuário.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth_key text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://([a-z0-9-]+\.)*(googleapis\.com|mozilla\.com|push\.apple\.com|notify\.windows\.com)/' then
    raise exception 'INVALID_ENDPOINT';
  end if;

  delete from public.push_subscriptions
  where id in (
    select id from public.push_subscriptions
    where user_id = auth.uid() and endpoint <> p_endpoint
    order by created_at desc
    offset 9
  );

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth_key, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth_key = excluded.auth_key,
        user_agent = excluded.user_agent, failures = 0;
end;
$$;

create function public.delete_push_subscription(p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end;
$$;

-- Aparelhos que devem receber o lembrete: quem ainda NÃO lançou nada desde p_since (início do dia).
create function public.reminder_targets(p_since timestamptz)
returns table (id uuid, user_id uuid, endpoint text, p256dh text, auth_key text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.user_id, s.endpoint, s.p256dh, s.auth_key
  from public.push_subscriptions s
  where s.failures < 5
    and not exists (
      select 1 from public.transactions t where t.created_by = s.user_id and t.created_at >= p_since
    );
$$;

-- Registra o resultado dos envios: ok zera as falhas, gone (404/410) apaga, failed soma uma falha (5 seguidas apagam).
create function public.record_push_results(p_ok uuid[], p_gone uuid[], p_failed uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.push_subscriptions set failures = 0, last_success_at = now() where id = any (coalesce(p_ok, '{}'));
  delete from public.push_subscriptions where id = any (coalesce(p_gone, '{}'));
  update public.push_subscriptions set failures = failures + 1 where id = any (coalesce(p_failed, '{}'));
  delete from public.push_subscriptions where failures >= 5;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;

revoke all on function public.reminder_targets(timestamptz) from public, anon, authenticated;
revoke all on function public.record_push_results(uuid[], uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.reminder_targets(timestamptz) to service_role;
grant execute on function public.record_push_results(uuid[], uuid[], uuid[]) to service_role;
