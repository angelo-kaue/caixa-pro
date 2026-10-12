-- Papéis que o PostgREST usa (equivalente ao que o Supabase configura). Só para testes locais.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'authpw' noinherit;
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;
grant usage on schema auth to authenticator;
grant usage on schema public to authenticator;
-- Mesma permissão padrão do Supabase: PostgREST precisa enxergar o que cada papel pode acessar.
alter default privileges in schema public grant all on tables to service_role;
grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to service_role;
