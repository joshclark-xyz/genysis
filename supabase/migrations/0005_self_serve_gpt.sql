-- =============================================================================
-- Genysis IQ - let a company build its own assistant
-- Run after 0004_file_terms.sql. Safe to re-run.
--
-- When staff switch this on for a company, that company may write its own
-- system_prompt and assistant_name. Everything else stays staff-only.
-- =============================================================================

alter table public.companies
  add column if not exists can_self_serve_gpt boolean not null default false;

comment on column public.companies.can_self_serve_gpt is
  'Staff-set. When true this company may write its own system_prompt and assistant_name.';

-- --------------------------------------------- guard, now self-serve aware --
create or replace function public.guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin() then
    -- Always staff-only, no exceptions.
    new.status             := old.status;
    new.api_customer_id    := old.api_customer_id;
    new.ai_model           := old.ai_model;
    new.ai_api_key         := old.ai_api_key;
    new.is_admin           := old.is_admin;
    new.can_self_serve_gpt := old.can_self_serve_gpt;

    -- The assistant itself is staff-only UNLESS this company has been granted
    -- self-serve. Note we test the OLD row: a client cannot grant themselves
    -- the right and use it in the same statement.
    if not coalesce(old.can_self_serve_gpt, false) then
      new.system_prompt  := old.system_prompt;
      new.assistant_name := old.assistant_name;
    end if;
  end if;
  return new;
end;
$$;
