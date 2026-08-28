# SEO & website analytics

Two things were added to the site: a full search-engine optimization pass, and
first-party traffic analytics that stream live into the admin console.

---

## Part 1 — SEO

### What is on every public page now

| | |
|---|---|
| `<title>` | Rewritten to lead with the keyword, then the brand |
| `description` | Unique per page, 150–160 characters |
| `keywords`, `author` | Present on all six pages |
| `robots` | `index, follow, max-snippet:-1, max-image-preview:large` — opts into large image previews |
| `canonical` | Absolute URL, prevents duplicate-content splits |
| Open Graph | `type`, `site_name`, `locale`, `title`, `description`, `url`, `image` + `width`/`height`/`alt` |
| Twitter / X | `summary_large_image` card with its own title, description and image |
| Geo | `geo.region`, `geo.placename`, `coverage` for local search |
| `sitemap` link | Points crawlers at `/sitemap.xml` |

### Structured data (JSON-LD)

Every page carries a `@graph` so Google can build an entity for the business
rather than reading loose HTML. All of it describes content that is actually
visible on the page — nothing is asserted that a person cannot see.

| Page | Schema types |
|---|---|
| `index.html` | `ProfessionalService`, `WebSite`, `WebPage`, `OfferCatalog` (all five services) |
| `services.html` | + five separate `Service` nodes, `BreadcrumbList` |
| `about.html` | + two `Person` nodes (Ron and Josh) with job titles, education and expertise |
| `contact.html` | `ContactPage` + `ContactPoint` with 24/7 `OpeningHoursSpecification` |
| `privacy.html`, `terms.html` | `WebPage` + `BreadcrumbList` |

The `ProfessionalService` node carries the phone number, email, Orlando address,
`areaServed: United States`, founders, and a `knowsAbout` list — this is what
feeds a knowledge panel.

### New files

- **`robots.txt`** — allows everything public, blocks the app pages and source
  directories. Notably it **explicitly allows GPTBot, ClaudeBot, PerplexityBot,
  OAI-SearchBot and Google-Extended**, so Genysis IQ can be cited by AI answer
  engines, and blocks Ahrefs/Semrush/DotBot/MJ12, which cost crawl budget and
  return nothing.
- **`sitemap.xml`** — all six public pages with `lastmod`, `changefreq`,
  `priority`, plus image entries for the hero and the two team photos.

### What you still have to do by hand

1. **Google Search Console** — add the property, verify it, submit
   `https://www.genysisiq.com/sitemap.xml`.
2. **Bing Webmaster Tools** — same, or just import from Search Console.
3. **Google Business Profile** — the single biggest lever for "business
   consultant Orlando" type searches. The `ProfessionalService` schema above is
   designed to corroborate it, so keep the name, phone and address identical.
4. **Update `lastmod`** in `sitemap.xml` when you change a page.
5. If the site is served at `genysisiq.com` **without** `www`, redirect one to
   the other at the host, and change the canonical URLs to match. Having both
   answer is the most common way a small site splits its own ranking.

---

## Part 2 — Analytics

### What it measures

- Page views, unique visitors, and sessions
- **Time on page counted only while the tab was actually visible** — not
  wall-clock time, which counts abandoned tabs as engagement
- Scroll depth per page
- Every link, button and form submission, with the visible label
- Where visitors came from: search engines, AI assistants, social, referrals, direct
- Desktop / tablet / mobile split
- Who is on the site *right now*

### Privacy shape

This is intentionally a cookie-free, PII-free design, which is what lets
`privacy.html` keep saying we run no third-party analytics:

- **No IP address is stored.**
- **No cookie is set.** The identifier is in `localStorage`.
- The visitor id is a **random uuid the browser generates for itself**. It is
  not linked to a name or email and means nothing on any other site.
- **No third party receives any of it.** No Google Analytics, no pixel.
- Form *contents* are never recorded — only that a form was submitted.

`privacy.html` section 7 was rewritten to disclose all of this honestly.

### Turning it off

| | |
|---|---|
| Site-wide | `ANALYTICS_ENABLED: false` in `assets/js/supabase-config.js` |
| One browser (yours) | Run `GenysisAnalytics.optOut()` in the browser console |
| One control | Add `data-no-track` to the element |
| Local testing | Off by default; set `ANALYTICS_TRACK_LOCALHOST: true` to include it |

Bots, headless browsers and anything driven by automation are skipped
automatically, so uptime checks and Lighthouse runs do not inflate the numbers.

### Setup

1. **Run the migration.** Open the Supabase SQL editor and run
   `supabase/migrations/0007_analytics.sql` in full. It is safe to re-run.

2. **Confirm Realtime is on.** Table Editor → `page_views` → Realtime toggle.
   The migration already adds both tables to the `supabase_realtime`
   publication, so this is usually on already.

3. **Be an admin.** The analytics view requires `is_admin = true` on your
   company row — the same flag the Companies view uses.

That is it. Open `admin.html`, click **Website traffic**, and it starts.

### How "live with no refresh" works

Two mechanisms, deliberately, because the first one can fail quietly:

1. **Supabase Realtime.** Every insert wakes the console immediately, so the
   live counter and the activity feed move the moment somebody clicks.
2. **A 20-second poll**, as a safety net. Realtime can be switched off in the
   project, a corporate proxy can eat the websocket, and laptops suspend. The
   poll means the numbers are never more than 20 seconds stale even with the
   socket gone.

The timestamp at the top right tells you which one is carrying you — it says
"live · connected" on the websocket, and "live updates unavailable · refreshing
every 20s" when it has fallen back. It never shows a green light that means
nothing.

The subscription is only held while the analytics view is actually on screen.

### Security

Verified against a real Postgres with the same roles Supabase uses:

- The anonymous key **cannot read a single row** of traffic data. It can only
  call the three `track_*` functions, which sanitise and clamp everything.
- A signed-in **client** cannot read traffic data and cannot call any
  `analytics_*` function — every one of them raises `admin only`.
- Only `is_admin = true` accounts can read or purge.
- Realtime evaluates the same RLS policies per subscriber, so a client sitting
  in the dashboard receives nothing from these tables.

### Retention

Nothing expires on its own. `privacy.html` commits to 12 months, so either
click **Clear all traffic data** periodically, or schedule the built-in purge:

```sql
select public.analytics_purge(365);   -- keeps the last 365 days
```
