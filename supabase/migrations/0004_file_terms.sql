-- =============================================================================
-- Genysis IQ - record acceptance of the file depot terms
-- Run after 0003_admin.sql. Safe to re-run.
--
-- Stored on the company row rather than in the browser so the acceptance
-- follows the account across devices, and so staff can see who agreed and when.
-- =============================================================================

alter table public.companies
  add column if not exists files_terms_accepted_at timestamptz;

comment on column public.companies.files_terms_accepted_at is
  'When this company accepted the file depot upload terms. Null means never.';

-- Deliberately NOT added to guard_privileged_columns(): the client is the one
-- who accepts, so they must be able to write this field on their own row. The
-- existing companies_update_own policy already limits them to that row.
