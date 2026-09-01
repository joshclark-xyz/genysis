-- =============================================================================
-- Genysis IQ client dashboard - AI assistant + chat history
-- Run after 0001_companies.sql. Safe to re-run.
-- =============================================================================

-- ------------------------------------------- per-company assistant config ----
-- All three are STAFF-CONTROLLED. The guard trigger from 0001 is extended below
-- so a client cannot rewrite their own prompt, model or key.
alter table public.companies
  add column if not exists system_prompt text,
  add column if not exists ai_model      text not null default 'openai/gpt-oss-120b',
  add column if not exists ai_api_key    text,
  add column if not exists assistant_name text not null default 'Genysis Assistant';

comment on column public.companies.system_prompt is
  'The instructions Genysis IQ writes for this company''s assistant. Never shown to the client.';
comment on column public.companies.ai_api_key is
  'Optional per-company key for the AI API. Falls back to the key in supabase-config.js.';

-- Extend the privileged-column guard from 0001 to cover the new fields.
create or replace function public.guard_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' then
    new.status          := old.status;
    new.api_customer_id := old.api_customer_id;
    new.system_prompt   := old.system_prompt;
    new.ai_model        := old.ai_model;
    new.ai_api_key      := old.ai_api_key;
    new.assistant_name  := old.assistant_name;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------ conversations --
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title      text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_company_idx
  on public.conversations (company_id, updated_at desc);

drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- messages --
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

-- Keep the parent conversation's timestamp current so lists sort sensibly.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- --------------------------------------------------------------------- RLS --
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

drop policy if exists "conversations_own" on public.conversations;
create policy "conversations_own"
  on public.conversations for all
  using (company_id = auth.uid())
  with check (company_id = auth.uid());

-- A message belongs to whoever owns its conversation.
drop policy if exists "messages_own" on public.messages;
create policy "messages_own"
  on public.messages for all
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.company_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.company_id = auth.uid()
    )
  );
