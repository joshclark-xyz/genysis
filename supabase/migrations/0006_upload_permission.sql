-- =============================================================================
-- Genysis IQ - uploading requires explicit permission
-- Run after 0005_self_serve_gpt.sql. Safe to re-run.
--
-- Nobody can upload until Genysis IQ grants it. Viewing and downloading what is
-- already in their space stays available.
-- =============================================================================

alter table public.companies
  add column if not exists can_upload_files boolean not null default false;

comment on column public.companies.can_upload_files is
  'Staff-set. False by default - a company cannot upload anything until granted.';

-- Existing accounts also start locked; grant deliberately, per company.
update public.companies set can_upload_files = false where can_upload_files is null;

-- ------------------------------------------------ guard the new column -----
create or replace function public.guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and not public.is_admin() then
    new.status             := old.status;
    new.api_customer_id    := old.api_customer_id;
    new.ai_model           := old.ai_model;
    new.ai_api_key         := old.ai_api_key;
    new.is_admin           := old.is_admin;
    new.can_self_serve_gpt := old.can_self_serve_gpt;
    new.can_upload_files   := old.can_upload_files;

    if not coalesce(old.can_self_serve_gpt, false) then
      new.system_prompt  := old.system_prompt;
      new.assistant_name := old.assistant_name;
    end if;
  end if;
  return new;
end;
$$;
