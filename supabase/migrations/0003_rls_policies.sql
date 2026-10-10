-- CaixaPro 0003: privilégios mínimos e Row Level Security

alter table public.plans enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.category_rules enable row level security;

-- Privilégios: começa sem nada e concede só o necessário (defesa em profundidade além do RLS).
revoke all on all tables in schema public from anon, authenticated;
grant select on public.plans, public.workspaces, public.workspace_members, public.subscriptions to authenticated;
grant update (name) on public.workspaces to authenticated;
grant select, insert, update, delete on public.categories, public.transactions, public.category_rules to authenticated;

-- Planos: leitura para autenticados
create policy plans_select on public.plans for select to authenticated using (true);

-- Espaços de trabalho: leitura por membros; renomear apenas por administradores.
-- Criação somente via create_workspace(); exclusão não exposta ao cliente nesta versão.
create policy workspaces_select on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.has_workspace_role(id, array['admin']::public.member_role[]))
  with check (public.has_workspace_role(id, array['admin']::public.member_role[]));

-- Membros e assinaturas: somente leitura para membros (escrita pelo backend)
create policy workspace_members_select on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- Categorias: categorias do sistema são imutáveis para o cliente
create policy categories_select on public.categories for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy categories_insert on public.categories for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and is_system = false);
create policy categories_update on public.categories for update to authenticated
  using (public.is_workspace_member(workspace_id) and is_system = false)
  with check (public.is_workspace_member(workspace_id) and is_system = false);
create policy categories_delete on public.categories for delete to authenticated
  using (public.is_workspace_member(workspace_id) and is_system = false);

-- Transações: o histórico visível respeita o plano; dados antigos são preservados num downgrade.
create policy transactions_select on public.transactions for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and occurred_on >= coalesce(public.history_cutoff(workspace_id), date '0001-01-01')
  );
create policy transactions_insert on public.transactions for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy transactions_update on public.transactions for update to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and occurred_on >= coalesce(public.history_cutoff(workspace_id), date '0001-01-01')
  )
  with check (public.is_workspace_member(workspace_id));
create policy transactions_delete on public.transactions for delete to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and occurred_on >= coalesce(public.history_cutoff(workspace_id), date '0001-01-01')
  );

-- Regras de classificação
create policy category_rules_select on public.category_rules for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy category_rules_insert on public.category_rules for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
create policy category_rules_update on public.category_rules for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
create policy category_rules_delete on public.category_rules for delete to authenticated
  using (public.is_workspace_member(workspace_id));
