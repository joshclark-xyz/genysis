-- =============================================================================
-- Genysis IQ client dashboard - initial schema
--
-- Run this once against the Supabase project (SQL Editor, or the CLI with
-- `supabase db push`). It is safe to re-run: every statement is idempotent.
-- =============================================================================

-- ---------------------------------------------------------------- companies --
-- One row per registered company, keyed to the Supabase auth user that owns it.
create table if not exists public.companies (
  id              uuid primary key references auth.users (id) on delete cascade,
  company_name    text not null,
  contact_name    text,
  email           text,
  phone           text,
  website         text,
  industry        text,

  -- Lifecycle: 'pending' until Genysis IQ provisions the account, then 'active'.
  status          text not null default 'pending'
                    check (status in ('pending', 'active', 'suspended')),

  -- Identifier this company is known by in the external AI/GPT API. Left null
  -- until Genysis IQ links the account.
  api_customer_id text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.companies is
  'Company profile for each registered dashboard user.';
comment on column public.companies.api_customer_id is
  'Identifier used by the external Genysis IQ AI API. Set by staff, not by the client.';

-- ------------------------------------------------------------ updated_at ----
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_touch_updated_at on public.companies;
create trigger companies_touch_updated_at
  before update on public.companies
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------- profile row on sign-up ----
-- Signup passes company_name / contact_name / phone as user metadata; this
-- copies them into the profile table so the dashboard has them immediately.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.companies (id, company_name, contact_name, email, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'company_name', ''), 'Unnamed company'),
    nullif(new.raw_user_meta_data ->> 'contact_name', ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------- RLS --
alter table public.companies enable row level security;

-- A company can only ever see and edit its own row.
drop policy if exists "companies_select_own" on public.companies;
create policy "companies_select_own"
  on public.companies for select
  using (auth.uid() = id);

drop policy if exists "companies_update_own" on public.companies;
create policy "companies_update_own"
  on public.companies for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Fallback for the rare case where the signup trigger did not run.
drop policy if exists "companies_insert_own" on public.companies;
create policy "companies_insert_own"
  on public.companies for insert
  with check (auth.uid() = id);

-- status and api_customer_id are staff-controlled. Clients may update their own
-- row, but not promote themselves or re-point their API identity.
create or replace function public.guard_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' then
    new.status          := old.status;
    new.api_customer_id := old.api_customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_guard_privileged on public.companies;
create trigger companies_guard_privileged
  before update on public.companies
  for each row execute function public.guard_privileged_columns();
