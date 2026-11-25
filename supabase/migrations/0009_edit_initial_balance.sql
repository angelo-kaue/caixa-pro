-- CaixaPro 0009: permite corrigir o saldo inicial do espaço de trabalho.
-- O cliente não tem UPDATE em workspaces.initial_balance_cents (só em name); a alteração passa por esta função,
-- que valida o valor e exige perfil de administrador do espaço.

create function public.set_initial_balance(p_workspace uuid, p_initial_balance_cents bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not public.has_workspace_role(p_workspace, array['admin']::public.member_role[]) then
    raise exception 'FORBIDDEN';
  end if;
  if p_initial_balance_cents is null or abs(p_initial_balance_cents) > 99999999999 then
    raise exception 'INVALID_BALANCE';
  end if;

  update public.workspaces set initial_balance_cents = p_initial_balance_cents where id = p_workspace;
end;
$$;

revoke all on function public.set_initial_balance(uuid, bigint) from public, anon;
grant execute on function public.set_initial_balance(uuid, bigint) to authenticated;
