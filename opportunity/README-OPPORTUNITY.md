# Genysis IQ — AI Services Direct Sales recruiting site

Public-facing recruiting site for the proposed AI Services Direct Sales Division.
Lives at `/opportunity/` and deploys with the rest of the site.

> **Currently `noindex`.** Every page carries `<meta name="robots" content="noindex, nofollow">`
> and `/opportunity/` is disallowed in `robots.txt`. See *Enabling public indexing*.

---

## Why this is static HTML and not Next.js

The brief asked for Next.js + TypeScript + Tailwind *if the project had no established
framework*. It also asked to preserve working configuration.

Those two instructions conflict here. `genysisiq.com` is a deliberately zero-build static
site — the live marketing pages, the Supabase dashboard and the Cloudflare file depot all
deploy as plain files. **Adding a Next.js app at the repository root would change how Vercel
builds the entire domain and would take the live site down.**

So this is built as a self-contained static section that mirrors the requested architecture:
centralized content, reusable rendered components, a status-label system, and accessible
interactive components — with zero build step and zero risk to the live site.

**If you would rather have the Next.js version**, the right move is a *separate* Vercel
project (its own repo, its own domain or subdomain such as `opportunity.genysisiq.com`).
Say the word and it can be built that way. It needs Node and npm on your machine, which the
rest of this project has never required.

---

## Local development

No build step, no dependencies.

```bash
python3 -m http.server 8931
```

Then open <http://localhost:8931/opportunity/>.

---

## Content editing

| What | Where |
|---|---|
| Navigation, disclaimers, contact details, status labels, CTA wording | `assets/content.js` |
| Page body copy, sections, service lists | the individual `.html` files |
| Colors, spacing, components | `assets/opportunity.css` |
| Menu, accordion, form validation, analytics events | `assets/opportunity.js` |

**Header and footer are rendered from `content.js`** into `<div id="giqHeader">` and
`<div id="giqFooter">` on every page. Change navigation or a disclaimer once in `content.js`
and all eleven pages update. You never edit a footer by hand.

Being straight about the split: things repeated across pages are centralized in
`content.js`; page-specific prose lives in its page. Centralizing every paragraph would mean
a build step, which is exactly what this setup avoids.

### Compensation percentages

Displayed on `compensation.html`. The seven-level chart bars are sized from the percentages,
so changing a number changes the bar. Update **both**:

1. `assets/content.js` → `comp.levels`
2. `compensation.html` → the `.levels` block and the two `.comp-stat` figures

The compensation disclaimer is in `content.js` → `disclaimers.compensation` and renders into
the footer of every page automatically.

### Adding a service

Add a card to the `.svc-grid` in `services.html`, and add a matching preview card in
`index.html`. Give it a unique `id` so `services.html#your-id` deep-links from the homepage.

---

## The interest form

Submissions post to **FormSubmit** and are delivered to `info@genysisiq.com`:

```html
<form action="https://formsubmit.co/info@genysisiq.com" method="POST">
```

**FormSubmit requires one-time activation.** Submit the form once from the live site; you
get a confirmation email with an activation link. Until you click it, submissions do not
arrive. This is the same mechanism the main contact form uses.

On success the visitor is sent to `thank-you.html` via the `_next` hidden field. That URL is
absolute — if the domain changes, update `_next` in `express-interest.html`.

Protections in place: a honeypot field bots fill and humans never see, client-side validation
with accessible error messaging, and a consent checkbox that blocks submission until ticked.
Submissions are never exposed publicly.

### Switching to a CRM or webhook instead

Replace the `action` attribute with your endpoint and remove the FormSubmit `_`-prefixed
hidden inputs. The form posts standard `application/x-www-form-urlencoded` fields named after
their `id`s (`first_name`, `last_name`, `email`, `phone`, `city`, `state`, `profession`,
`ds_experience`, `years`, `built_org`, `largest_org`, `market`, `interestType`, `best_time`,
`comments`, `consent`).

---

## Enabling public indexing

Two locks, both deliberate. Release both when Genysis IQ approves indexing:

1. **Remove the meta tag** from all eleven pages:
   ```bash
   cd opportunity
   sed -i '' '/name="robots" content="noindex, nofollow"/d' *.html
   ```
2. **Remove the crawl block** — delete the `Disallow: /opportunity/` line from
   `/robots.txt` in the project root.
3. Optionally set `SITE_INDEXING_ENABLED = true` in `assets/content.js` (a flag for future
   scripting; it does not itself control the meta tag, because runtime JS runs too late to
   stop a crawler).
4. Add the pages to `/sitemap.xml`.

---

## Analytics

Recruiting-funnel events fire through the site's existing first-party tracker and appear in
the admin console's **Website traffic** view. No third-party pixel, no profiling.

Events: `Explore Opportunity click`, `View Services click`, `Compensation Preview click`,
`Compensation Preview view`, `Founding Leader click`, `Founding Leader page view`,
`AI Platform click`, `Express Interest started`, `Express Interest submitted`.

The tracker is not loaded on `/opportunity/` by default. To enable it, add before
`</body>` on each page:

```html
<script src="../assets/js/supabase-config.js" defer></script>
<script src="../assets/js/analytics.js" defer></script>
```

---

## Deployment

Static files. Deploy the way you already deploy the rest of the site — no build command,
no environment variables, no new dependencies. `/opportunity/` becomes
`https://www.genysisiq.com/opportunity/`.

---

## Compliance guardrails already built in

These are load-bearing. Removing them changes the legal posture of the site.

- Persistent **FOUNDING-STAGE OPPORTUNITY — PROGRAM IN DEVELOPMENT** bar on every page
- Founding-stage notice, compensation notice and program disclaimer in every footer
- Every compensation figure carries a **Proposed** or **In Development** badge
- The $395 package is labelled proposed, and explicitly **not** described as an investment
- Founding Leader limits stated plainly, including "does not imply company ownership"
- Security services carry the "no guarantee" and "scanning is not penetration testing" notice
- Consent checkbox states that submitting does not enroll, guarantee acceptance, or promise earnings
- No income claims, no earnings examples, no testimonials, no countdown timers

### Deliberately **not** published

The internal planning documents contain material that is not on this site and should not be
added: service economics and fulfillment costs, provider payment formulas, internal margins,
payout ceilings, Fast Start formulas, governance architecture, AI authority matrices,
compensation stress testing, and ownership or phantom-equity discussion.

Source documents are archived outside the deployed site in
`_source-originals/direct-sales/`.
