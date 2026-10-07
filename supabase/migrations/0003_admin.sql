-- =============================================================================
-- Genysis IQ - staff admin console
-- Run after 0002_ai_chat.sql. Safe to re-run.
--
-- Adds an admin flag, lets admins see and manage every company, and opens the
-- privileged columns (status, system_prompt, ai_model, ...) to admins only.
-- =============================================================================

alter table public.companies
  add column if not exists is_admin boolean not null default false;

comment on column public.companies.is_admin is
  'Genysis IQ staff. Grants read/write over every company row. Set manually in SQL.';

-- ------------------------------------------------------------- is_admin() ---
-- SECURITY DEFINER so the lookup bypasses RLS on companies. Without that, a
-- policy that calls this function while evaluating companies would recurse.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select c.is_admin from public.companies c where c.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ------------------------------------------------------- admin RLS access ---
drop policy if exists "companies_admin_all" on public.companies;
create policy "companies_admin_all"
  on public.companies for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admins can review conversations for support purposes.
drop policy if exists "conversations_admin_read" on public.conversations;
create policy "conversations_admin_read"
  on public.conversations for select
  to authenticated
  using (public.is_admin());

drop policy if exists "messages_admin_read" on public.messages;
create policy "messages_admin_read"
  on public.messages for select
  to authenticated
  using (public.is_admin());

-- --------------------------------------------- guard, now admin-aware ------
-- Clients still cannot touch the privileged columns. Admins can.
create or replace function public.guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin() then
    new.status          := old.status;
    new.api_customer_id := old.api_customer_id;
    new.system_prompt   := old.system_prompt;
    new.ai_model        := old.ai_model;
    new.ai_api_key      := old.ai_api_key;
    new.assistant_name  := old.assistant_name;
    new.is_admin        := old.is_admin;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------ dashboard summary ---
-- One row per company with its conversation/message counts, for the console.
create or replace view public.admin_companies as
select
  c.id,
  c.company_name,
  c.contact_name,
  c.email,
  c.phone,
  c.website,
  c.industry,
  c.status,
  c.assistant_name,
  c.system_prompt,
  c.ai_model,
  c.api_customer_id,
  c.is_admin,
  c.created_at,
  (select count(*) from public.conversations v where v.company_id = c.id) as conversation_count,
  (select count(*) from public.messages m
     join public.conversations v2 on v2.id = m.conversation_id
    where v2.company_id = c.id) as message_count
from public.companies c;

-- The view runs with the querying user's permissions, so companies RLS still
-- applies: non-admins see only their own row.
alter view public.admin_companies set (security_invoker = true);

grant select on public.admin_companies to authenticated;


-- =============================================================================
-- MAKE YOURSELF AN ADMIN
-- Register through the dashboard first, then run this once with your email:
--
--   update public.companies set is_admin = true where email = 'info@genysisiq.com';
--
-- =============================================================================
