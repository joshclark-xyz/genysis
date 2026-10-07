-- =============================================================================
-- Genysis IQ - website analytics
-- Run after 0006_upload_permission.sql. Safe to re-run.
--
-- First-party traffic analytics: page views, active time on page, scroll depth
-- and click events, aggregated for the staff console and streamed live over
-- Supabase Realtime.
--
-- Privacy shape - this is deliberately cookie-free and PII-free:
--   * no IP address is stored
--   * no cross-site identifier, no third-party script
--   * the visitor id is a random uuid the browser generates for itself and
--     keeps in localStorage; it means nothing outside this site
-- That is what lets privacy.html keep saying we run no third-party analytics.
-- =============================================================================

-- ---------------------------------------------------------------- tables ----

create table if not exists public.page_views (
  id            uuid primary key default gen_random_uuid(),
  visitor_id    uuid        not null,
  session_id    uuid        not null,
  path          text        not null,
  title         text,
  referrer      text,
  referrer_host text,
  source        text        not null default 'direct',   -- direct|organic|social|ai|referral|internal
  device        text        not null default 'desktop',  -- desktop|tablet|mobile
  screen_w      int,
  is_new        boolean     not null default false,      -- first ever view for this visitor
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  active_ms     int         not null default 0,          -- time the tab was actually visible
  max_scroll    int         not null default 0           -- percent, 0-100
);

comment on table public.page_views is
  'One row per page load. active_ms counts only time the tab was visible.';

create index if not exists page_views_started_idx  on public.page_views (started_at desc);
create index if not exists page_views_path_idx     on public.page_views (path, started_at desc);
create index if not exists page_views_visitor_idx  on public.page_views (visitor_id, started_at desc);
create index if not exists page_views_lastseen_idx on public.page_views (last_seen_at desc);

create table if not exists public.page_events (
  id          bigint generated always as identity primary key,
  view_id     uuid        references public.page_views (id) on delete cascade,
  visitor_id  uuid        not null,
  path        text        not null,
  kind        text        not null,        -- click|cta|outbound|form|call|email|scroll|video
  label       text,                        -- human-readable name of what was clicked
  href        text,
  created_at  timestamptz not null default now()
);

comment on table public.page_events is
  'Clicks and other interactions. `label` is the visible text of the control.';

create index if not exists page_events_created_idx on public.page_events (created_at desc);
create index if not exists page_events_kind_idx    on public.page_events (kind, created_at desc);
create index if not exists page_events_label_idx   on public.page_events (path, label);

-- ------------------------------------------------------------------- RLS ----
-- Nothing is readable by the public. Writes happen only through the security
-- definer functions below, which sanitise and clamp everything they are given.

alter table public.page_views  enable row level security;
alter table public.page_events enable row level security;

drop policy if exists "page_views_admin_read" on public.page_views;
create policy "page_views_admin_read"
  on public.page_views for select to authenticated
  using (public.is_admin());

drop policy if exists "page_events_admin_read" on public.page_events;
create policy "page_events_admin_read"
  on public.page_events for select to authenticated
  using (public.is_admin());

-- Admins may clear the log.
drop policy if exists "page_views_admin_delete" on public.page_views;
create policy "page_views_admin_delete"
  on public.page_views for delete to authenticated
  using (public.is_admin());

drop policy if exists "page_events_admin_delete" on public.page_events;
create policy "page_events_admin_delete"
  on public.page_events for delete to authenticated
  using (public.is_admin());


-- ============================================================ WRITE PATH ====
-- These are the only things the anonymous website may call.

-- Normalise a path so "/", "/index.html" and "/index.html?utm=x" are one page.
create or replace function public.tidy_path(p text)
returns text language sql immutable as $$
  select case
    when p is null or btrim(p) = '' then '/'
    else left(
      regexp_replace(
        regexp_replace(split_part(p, '?', 1), '/index\.html$', '/'),
        '^([^/])', '/\1'),
      120)
  end;
$$;

-- ------------------------------------------------------------ track_view ----
create or replace function public.track_view(
  p_visitor  uuid,
  p_session  uuid,
  p_path     text,
  p_title    text default null,
  p_referrer text default null,
  p_device   text default 'desktop',
  p_screen_w int  default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_host    text;
  v_source  text;
  v_new     boolean;
begin
  if p_visitor is null or p_session is null then
    raise exception 'visitor and session are required';
  end if;

  -- Referrer host, minus the scheme and any path.
  v_host := nullif(lower(split_part(regexp_replace(coalesce(p_referrer, ''), '^https?://', ''), '/', 1)), '');

  v_source := case
    when v_host is null                                             then 'direct'
    when v_host like '%genysisiq.com'                               then 'internal'
    when v_host ~ 'google\.|bing\.|duckduckgo\.|yahoo\.|ecosia\.|brave\.' then 'organic'
    when v_host ~ 'chatgpt\.|openai\.|perplexity\.|claude\.|gemini\.|copilot\.' then 'ai'
    when v_host ~ 'facebook\.|instagram\.|linkedin\.|twitter\.|x\.com|t\.co|reddit\.|youtube\.|tiktok\.' then 'social'
    else 'referral'
  end;

  -- "New" means we have never seen this visitor id before.
  v_new := not exists (select 1 from public.page_views v where v.visitor_id = p_visitor);

  insert into public.page_views
    (visitor_id, session_id, path, title, referrer, referrer_host, source, device, screen_w, is_new)
  values
    (p_visitor,
     p_session,
     public.tidy_path(p_path),
     left(nullif(btrim(coalesce(p_title, '')), ''), 200),
     left(nullif(btrim(coalesce(p_referrer, '')), ''), 300),
     v_host,
     v_source,
     case when p_device in ('desktop', 'tablet', 'mobile') then p_device else 'desktop' end,
     greatest(0, least(coalesce(p_screen_w, 0), 20000)),
     v_new)
  returning id into v_id;

  return v_id;
end;
$$;

-- ------------------------------------------------------------ track_ping ----
-- Called on a timer and again as the page unloads. Monotonic: active time only
-- ever goes up, so a late-arriving beacon can never shrink a longer reading.
create or replace function public.track_ping(
  p_view   uuid,
  p_ms     int,
  p_scroll int default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.page_views
     set active_ms    = greatest(active_ms, least(greatest(coalesce(p_ms, 0), 0), 4 * 60 * 60 * 1000)),
         max_scroll   = greatest(max_scroll, least(greatest(coalesce(p_scroll, 0), 0), 100)),
         last_seen_at = now()
   where id = p_view;
end;
$$;

-- ----------------------------------------------------------- track_event ----
create or replace function public.track_event(
  p_view  uuid,
  p_kind  text,
  p_label text default null,
  p_href  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visitor uuid;
  v_path    text;
begin
  select visitor_id, path into v_visitor, v_path
    from public.page_views where id = p_view;

  if v_visitor is null then return; end if;   -- unknown view, drop it silently

  insert into public.page_events (view_id, visitor_id, path, kind, label, href)
  values (
    p_view, v_visitor, v_path,
    case when p_kind in ('click','cta','outbound','form','call','email','scroll','video')
         then p_kind else 'click' end,
    left(nullif(btrim(coalesce(p_label, '')), ''), 120),
    left(nullif(btrim(coalesce(p_href, '')), ''), 300)
  );

  update public.page_views set last_seen_at = now() where id = p_view;
end;
$$;

revoke all on function public.track_view(uuid, uuid, text, text, text, text, int) from public;
revoke all on function public.track_ping(uuid, int, int) from public;
revoke all on function public.track_event(uuid, text, text, text) from public;

grant execute on function public.track_view(uuid, uuid, text, text, text, text, int) to anon, authenticated;
grant execute on function public.track_ping(uuid, int, int)                          to anon, authenticated;
grant execute on function public.track_event(uuid, text, text, text)                 to anon, authenticated;


-- ============================================================= READ PATH ====
-- Aggregates for the staff console. Every one of these refuses to answer unless
-- the caller is an admin, so the anon key cannot read traffic data.

-- Everything is bucketed in the company's own timezone, not UTC, so "today"
-- means today in Orlando rather than today in Greenwich.
create or replace function public.analytics_tz() returns text
language sql immutable as $$ select 'America/New_York' $$;

-- -------------------------------------------------------------- overview ----
create or replace function public.analytics_overview()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz         text := public.analytics_tz();
  v_day_start  timestamptz := date_trunc('day',  timezone(v_tz, now())) at time zone v_tz;
  v_week_start timestamptz := date_trunc('week', timezone(v_tz, now())) at time zone v_tz;
  v_result     json;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select json_build_object(
    'generated_at',      now(),
    'timezone',          v_tz,

    'visitors_today',    count(distinct visitor_id) filter (where started_at >= v_day_start),
    'visitors_week',     count(distinct visitor_id) filter (where started_at >= v_week_start),
    'views_today',       count(*)                   filter (where started_at >= v_day_start),
    'views_week',        count(*)                   filter (where started_at >= v_week_start),
    'sessions_today',    count(distinct session_id) filter (where started_at >= v_day_start),
    'new_today',         count(distinct visitor_id) filter (where started_at >= v_day_start and is_new),

    -- Anyone whose tab has checked in within the last two minutes.
    'live_now',          count(distinct visitor_id) filter (where last_seen_at >= now() - interval '2 minutes'),
    'live_views',        count(*)                   filter (where last_seen_at >= now() - interval '2 minutes'),

    'avg_seconds_today', coalesce(round(avg(active_ms / 1000.0)
                           filter (where started_at >= v_day_start and active_ms > 0))::int, 0),
    'avg_seconds_week',  coalesce(round(avg(active_ms / 1000.0)
                           filter (where started_at >= v_week_start and active_ms > 0))::int, 0),

    -- A bounce is a session with exactly one page view.
    'bounce_rate_week',  coalesce((
        select round(100.0 * count(*) filter (where n = 1) / nullif(count(*), 0))::int
          from (select session_id, count(*) as n
                  from public.page_views
                 where started_at >= v_week_start
                 group by session_id) s), 0),

    'views_total',       count(*),
    'visitors_total',    count(distinct visitor_id),

    'clicks_today',      (select count(*) from public.page_events where created_at >= v_day_start),
    'clicks_week',       (select count(*) from public.page_events where created_at >= v_week_start)
  )
  into v_result
  from public.page_views;

  return v_result;
end;
$$;

-- ------------------------------------------------------------- top pages ----
create or replace function public.analytics_pages(p_days int default 7)
returns table (
  path            text,
  title           text,
  views           bigint,
  visitors        bigint,
  avg_seconds     int,
  total_seconds   bigint,
  avg_scroll      int,
  clicks          bigint,
  share           numeric
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 365)));
  v_total bigint;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select count(*) into v_total from public.page_views where started_at >= v_since;

  return query
  select v.path,
         (array_agg(v.title order by v.started_at desc)
            filter (where v.title is not null))[1]                   as title,
         count(*)                                                    as views,
         count(distinct v.visitor_id)                                as visitors,
         coalesce(round(avg(v.active_ms / 1000.0)
           filter (where v.active_ms > 0))::int, 0)                  as avg_seconds,
         coalesce(round(sum(v.active_ms) / 1000.0)::bigint, 0)       as total_seconds,
         coalesce(round(avg(nullif(v.max_scroll, 0)))::int, 0)       as avg_scroll,
         (select count(*) from public.page_events e
           where e.path = v.path and e.created_at >= v_since)        as clicks,
         round(100.0 * count(*) / nullif(v_total, 0), 1)             as share
    from public.page_views v
   where v.started_at >= v_since
   group by v.path
   order by count(*) desc;
end;
$$;

-- ---------------------------------------------------------------- clicks ----
create or replace function public.analytics_clicks(p_days int default 7)
returns table (label text, kind text, href text, path text, clicks bigint, visitors bigint)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 365)));
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  select coalesce(e.label, e.href, '(unnamed)')                 as label,
         e.kind,
         (array_agg(e.href) filter (where e.href is not null))[1] as href,
         (array_agg(e.path order by e.created_at desc))[1]      as path,
         count(*)                                              as clicks,
         count(distinct e.visitor_id)                          as visitors
    from public.page_events e
   where e.created_at >= v_since
   group by coalesce(e.label, e.href, '(unnamed)'), e.kind
   order by count(*) desc
   limit 40;
end;
$$;

-- ----------------------------------------------------------- daily trend ----
create or replace function public.analytics_daily(p_days int default 14)
returns table (day date, views bigint, visitors bigint, clicks bigint)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_tz   text := public.analytics_tz();
  v_days int  := greatest(1, least(coalesce(p_days, 14), 365));
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  -- generate_series so days with zero traffic still produce a bar
  with span as (
    select generate_series(
             (date_trunc('day', timezone(v_tz, now())) - make_interval(days => v_days - 1))::date,
             date_trunc('day', timezone(v_tz, now()))::date,
             interval '1 day')::date as day
  )
  select s.day,
         count(v.id)                                          as views,
         count(distinct v.visitor_id)                         as visitors,
         coalesce((select count(*) from public.page_events e
                    where (timezone(v_tz, e.created_at))::date = s.day), 0) as clicks
    from span s
    left join public.page_views v
           on (timezone(v_tz, v.started_at))::date = s.day
   group by s.day
   order by s.day;
end;
$$;

-- --------------------------------------------------------------- sources ----
create or replace function public.analytics_sources(p_days int default 7)
returns table (source text, referrer_host text, views bigint, visitors bigint)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 365)));
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  select v.source,
         coalesce(v.referrer_host, '—') as referrer_host,
         count(*)                       as views,
         count(distinct v.visitor_id)   as visitors
    from public.page_views v
   where v.started_at >= v_since
   group by v.source, coalesce(v.referrer_host, '—')
   order by count(*) desc
   limit 25;
end;
$$;

-- --------------------------------------------------------------- devices ----
create or replace function public.analytics_devices(p_days int default 7)
returns table (device text, views bigint, visitors bigint)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 365)));
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  select v.device, count(*) as views, count(distinct v.visitor_id) as visitors
    from public.page_views v
   where v.started_at >= v_since
   group by v.device
   order by count(*) desc;
end;
$$;

-- --------------------------------------------------------- live activity ----
-- The feed on the right of the analytics view. Views and clicks interleaved.
create or replace function public.analytics_live(p_limit int default 40)
returns table (happened_at timestamptz, kind text, path text, label text,
                device text, source text, is_new boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  select * from (
    (select v.started_at as happened_at, 'view'::text as kind, v.path, v.title as label,
            v.device, v.source, v.is_new
       from public.page_views v
      order by v.started_at desc
      limit greatest(1, least(coalesce(p_limit, 40), 200)))
    union all
    (select e.created_at, e.kind, e.path, e.label, '-'::text, '-'::text, false
       from public.page_events e
      order by e.created_at desc
      limit greatest(1, least(coalesce(p_limit, 40), 200)))
  ) feed
  order by feed.happened_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 200));
end;
$$;

-- ------------------------------------------------------- who is on right now -
create or replace function public.analytics_now()
returns table (path text, visitors bigint, seconds int)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  select v.path,
         count(distinct v.visitor_id) as visitors,
         coalesce(round(avg(v.active_ms / 1000.0))::int, 0) as seconds
    from public.page_views v
   where v.last_seen_at >= now() - interval '2 minutes'
   group by v.path
   order by count(distinct v.visitor_id) desc;
end;
$$;

-- ------------------------------------------------------------------ purge ----
create or replace function public.analytics_purge(p_days int default 0)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare n bigint;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  -- p_days = 0 wipes everything; otherwise keep the last N days.
  if coalesce(p_days, 0) <= 0 then
    delete from public.page_events;
    delete from public.page_views;
    get diagnostics n = row_count;
  else
    delete from public.page_views
     where started_at < now() - make_interval(days => p_days);
    get diagnostics n = row_count;
  end if;

  return n;
end;
$$;

revoke all on function public.analytics_overview()  from public;
revoke all on function public.analytics_pages(int)   from public;
revoke all on function public.analytics_clicks(int)  from public;
revoke all on function public.analytics_daily(int)   from public;
revoke all on function public.analytics_sources(int) from public;
revoke all on function public.analytics_devices(int) from public;
revoke all on function public.analytics_live(int)    from public;
revoke all on function public.analytics_now()        from public;
revoke all on function public.analytics_purge(int)   from public;

grant execute on function public.analytics_overview()        to authenticated;
grant execute on function public.analytics_pages(int)        to authenticated;
grant execute on function public.analytics_clicks(int)       to authenticated;
grant execute on function public.analytics_daily(int)        to authenticated;
grant execute on function public.analytics_sources(int)      to authenticated;
grant execute on function public.analytics_devices(int)      to authenticated;
grant execute on function public.analytics_live(int)         to authenticated;
grant execute on function public.analytics_now()             to authenticated;
grant execute on function public.analytics_purge(int)        to authenticated;


-- ============================================================== REALTIME ====
-- What makes the console update with no refresh. Realtime evaluates the RLS
-- policies above per subscriber, so only a signed-in admin receives anything.

alter table public.page_views  replica identity full;
alter table public.page_events replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.page_views;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.page_events;
  exception when duplicate_object then null;
  end;
end $$;
