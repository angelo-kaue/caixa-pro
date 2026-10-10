-- CaixaPro 0001: esquema principal (tipos, tabelas e catálogo de planos)
-- Dinheiro sempre em centavos (bigint). Limite: R$ 999.999.999,99.

create type public.workspace_type as enum ('personal', 'business');
create type public.member_role as enum ('admin', 'manager', 'member');
create type public.transaction_kind as enum ('income', 'expense');
create type public.plan_id as enum ('free', 'pro', 'enterprise');
create type public.subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'incomplete');

-- Catálogo de planos (espelha src/config/plans.ts; NULL = ilimitado)
create table public.plans (
  id public.plan_id primary key,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  max_transactions_per_month integer check (max_transactions_per_month is null or max_transactions_per_month > 0),
  history_months integer check (history_months is null or history_months > 0),
  max_active_budgets integer check (max_active_budgets is null or max_active_budgets > 0),
  max_members integer check (max_members is null or max_members > 0)
);

insert into public.plans (id, name, price_cents, max_transactions_per_month, history_months, max_active_budgets, max_members) values
  ('free', 'Free', 0, 100, 3, 3, 1),
  ('pro', 'Pro', 1990, null, null, null, 1),
  ('enterprise', 'Enterprise', 7990, null, null, null, null);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  type public.workspace_type not null,
  name text not null check (char_length(name) between 1 and 80),
  initial_balance_cents bigint not null default 0 check (abs(initial_balance_cents) <= 99999999999),
  created_at timestamptz not null default now()
);
-- Primeira versão: um espaço de trabalho por usuário. Remover este índice habilita múltiplos espaços.
create unique index workspaces_one_per_owner on public.workspaces (owner_id);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

-- Assinatura por espaço de trabalho. Escrita apenas pelo backend (service role / Edge Functions).
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  plan_id public.plan_id not null default 'free' references public.plans (id),
  status public.subscription_status not null default 'active',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind public.transaction_kind not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, kind, name),
  unique (id, workspace_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  kind public.transaction_kind not null,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 99999999999),
  description text not null check (char_length(btrim(description)) between 1 and 140),
  category_id uuid,
  occurred_on date not null default current_date,
  payment_method text check (payment_method is null or payment_method in ('pix', 'credit_card', 'debit_card', 'cash', 'bank_slip', 'transfer', 'other')),
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A categoria precisa pertencer ao mesmo espaço de trabalho da transação.
  foreign key (category_id, workspace_id) references public.categories (id, workspace_id)
);
create index transactions_ws_date_idx on public.transactions (workspace_id, occurred_on desc);
create index transactions_ws_category_idx on public.transactions (workspace_id, category_id);
create unique index transactions_idempotency_idx on public.transactions (workspace_id, idempotency_key) where idempotency_key is not null;

-- Preferências de classificação: palavra-chave -> categoria, por espaço de trabalho.
create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  keyword text not null check (keyword = lower(keyword) and char_length(keyword) between 1 and 60),
  category_id uuid not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, keyword),
  foreign key (category_id, workspace_id) references public.categories (id, workspace_id) on delete cascade
);
