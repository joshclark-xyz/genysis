-- =============================================================================
-- Genysis IQ - switch the AI provider from Groq to DeepSeek
-- Run after 0007_analytics.sql. Safe to re-run.
--
-- The dashboard now chats DIRECTLY with DeepSeek's OpenAI-compatible API
-- (AI_API_BASE_URL in assets/js/supabase-config.js = https://api.deepseek.com)
-- instead of the Groq-backed gateway, whose shared free-tier tokens-per-minute
-- budget was too small for several concurrent clients. DeepSeek is
-- pay-as-you-go: the platform balance is the budget.
--
-- Model ids are DeepSeek's own endpoint names:
--   deepseek-flash      V4.1-Flash, thinking mode, reasoning_effort low - the
--                       default. (deepseek-v4-flash is a temporary alias.)
--   deepseek-v4-pro     pro tier; currently routes to V4.1-Flash until
--                       V4.1-Pro launches.
--
-- The old deepseek-chat / deepseek-reasoner names were retired 2026-07-24 and
-- must NOT be used.
-- =============================================================================

-- New companies default to DeepSeek.
alter table public.companies
  alter column ai_model set default 'deepseek-flash';

-- Move every company still pointing at the old Groq models.
update public.companies
   set ai_model = 'deepseek-flash'
 where ai_model in ('openai/gpt-oss-120b',
                    'openai/gpt-oss-20b',
                    'openai/gpt-oss-safeguard-20b');
