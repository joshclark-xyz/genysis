# Genysis IQ — Client Dashboard Setup

Companies register, verify their email, and sign in to reach the custom AI
assistants Genysis IQ builds for them. Same stack as the rest of the site:
plain HTML, CSS and JavaScript. No build step, no framework, no npm.

---

## Files

| File | Purpose |
|---|---|
| `login.html` | Sign in, register, and request a password reset |
| `dashboard.html` | The authenticated dashboard |
| `update-password.html` | Where the password-reset email lands |
| `assets/app.css` | Dashboard styling (extends `styles.css`) |
| `assets/js/supabase-config.js` | **The only file you need to edit** |
| `assets/js/auth.js` | Wraps every Supabase call |
| `assets/js/login.js` | Login page behaviour |
| `assets/js/dashboard.js` | Dashboard behaviour |
| `assets/js/assistants.js` | Where the external AI API gets plugged in |
| `supabase/migrations/0001_companies.sql` | Companies table, RLS, signup trigger |
| `supabase/migrations/0002_ai_chat.sql` | Assistant config, conversations, messages |
| `supabase/migrations/0003_admin.sql` | Admin flag, staff RLS, admin view |
| `admin.html` | Staff console: approve companies, build their GPT |
| `assets/js/ai.js` | The chat client (streaming + non-streaming) |
| `assets/js/markdown.js` | Renders assistant replies as sanitized markdown |
| `assets/js/files.js` | File depot client |
| `assets/js/session.js` | Session storage mode and idle timeout |
| `cloudflare/worker.js` | The R2-backed file service |

---

## Setup

### 1. Create the Supabase project

Any name and region. Once it exists, open **Project Settings**:

- **Data API → Project URL** — looks like `https://abcdefgh.supabase.co`
- **API Keys → anon / publishable key** — a long string starting `eyJ…` or `sb_publishable_…`

The anon key is meant to be public. Row Level Security is what protects the
data. **Never** put the `service_role` key in these files.

### 2. Run the migration

Supabase dashboard → **SQL Editor**. Run both files in order:

1. `supabase/migrations/0001_companies.sql`
2. `supabase/migrations/0002_ai_chat.sql`
3. `supabase/migrations/0003_admin.sql`

It is safe to re-run. It creates:

- a `companies` table, one row per registered company
- RLS policies so a company can only ever read and edit its own row
- a trigger that creates the profile row automatically at signup
- a guard so clients cannot change their own `status` or `api_customer_id`

### 3. Paste your keys in

Edit `assets/js/supabase-config.js`:

```js
SUPABASE_URL: "https://abcdefgh.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
```

Until you do, the login page shows a "Not connected yet" notice and disables
the forms rather than failing silently.

### 4. Turn on email verification

Supabase dashboard → **Authentication → Sign In / Providers → Email**:

- **Confirm email** → ON

Then **Authentication → URL Configuration**, add every origin the site runs on
to **Redirect URLs**:

```
http://localhost:8000/**
https://www.genysisiq.com/**
```

Without the localhost entry, verification links clicked during testing will
bounce. Set **Site URL** to `https://www.genysisiq.com` for production.

> Supabase's built-in email sender is rate-limited (a few messages per hour)
> and is fine for testing. Before real clients use this, connect a proper SMTP
> provider under **Authentication → Emails → SMTP Settings**, or verification
> emails will start silently failing.

### 5. Test on localhost

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/login.html>.

`file://` will not work — Supabase auth needs a real HTTP origin.

Walk through:

1. **Create account** — fill the form, submit, see "Check your email"
2. Click the link in the email → lands on the dashboard, verified
3. **Sign out**, then sign back in
4. **Forgot password** → email → `update-password.html` → set a new one
5. Try signing in before verifying → friendly error with a "resend" link

---

## The AI assistant

The dashboard has a working chat, wired to:

```
POST {AI_API_BASE_URL}/v1/ai/chat?API={key}
```

Both values live in `assets/js/supabase-config.js` and are already filled in
with the test endpoint and key.

### The system prompt is yours, not theirs

Every request sends the company's `system_prompt` as the first message. That
column is **staff-only** — a database trigger silently reverts any attempt by a
client to change `system_prompt`, `ai_model`, `ai_api_key` or `assistant_name`,
even though clients can edit the rest of their own row. The prompt is never
displayed in the dashboard.

Run `supabase/migrations/0002_ai_chat.sql` to add these columns plus the
`conversations` and `messages` tables.

### Turning on a company's assistant

```sql
update public.companies
set status         = 'active',
    assistant_name = 'Acme Ops Assistant',
    system_prompt  = 'You are the operations assistant for Acme Manufacturing. ...',
    ai_model       = 'openai/gpt-oss-120b'   -- optional, this is the default
where email = 'client@example.com';
```

Optionally give them their own key, which overrides the shared one:

```sql
update public.companies set ai_api_key = 'api_their_key' where email = '...';
```

Until you do this the client sees an honest status rather than a broken chat:

| Situation | What they see |
|---|---|
| No endpoint or key | "Your assistant is being set up" |
| Connected, no `system_prompt` | "Almost ready" |
| Fully configured | The working chat |

### Formatting and streaming

Replies stream in token by token and render as full markdown: headings, bold
and italic, bulleted and numbered lists, tables, blockquotes, inline code, and
fenced code blocks with syntax highlighting, a language label and a copy button.

Model output is untrusted text rendered as HTML, so every reply goes through
DOMPurify before it touches the DOM. Links are forced to `rel="noopener
noreferrer nofollow"` and only http, https, mailto and tel URLs survive.

The endpoint also streams `delta.reasoning` — the model thinking out loud. That
is deliberately discarded and never shown to clients.

### Managing conversations

- **Delete one** — hover a conversation in the sidebar and click the bin, or use
  **Delete** in the transcript toolbar. Messages go with it (the foreign key
  cascades), and if the open conversation is the one deleted the next one opens
  automatically.
- **Delete all** — a button under *New conversation*, shown once there are two
  or more. It asks twice, because there is no undo.
- **Copy a message** — every message, yours and the assistant's, has a Copy
  button. It copies the original markdown rather than the flattened rendering,
  so tables and code survive being pasted elsewhere.
- **Copy transcript** — the whole conversation as a markdown document with
  speaker names, ready to paste into a doc or an email.

Deletes run through the same RLS policies as everything else: a company can
only ever delete its own conversations.

### How the chat behaves

- Conversations and messages are stored in Supabase, so history follows the
  user across devices. RLS scopes both tables to the owning company.
- The endpoint is stateless, so the last 24 turns are re-sent as context each
  time. Multi-turn follow-ups work.
- Conversations are auto-titled from the first message.
- Enter sends, Shift+Enter adds a line.
- If a turn fails, the user message is rolled out of the context history so a
  failed exchange is not replayed on the next attempt.

### Security note on the API key

`AI_API_KEY` sits in a JavaScript file, so **any signed-in client can read it**
in their browser's network tab. That is acceptable for the test key. Before
production, pick one:

1. **Per-company keys** — set `ai_api_key` on each company row. RLS means a
   client can only ever read their own, so one client's key leaking does not
   expose anyone else's.
2. **Proxy it** — put a Supabase Edge Function between the dashboard and the AI
   API, holding the key server-side as a secret. The browser then never sees a
   key at all. This is the right answer if the key is billable or shared.

Option 2 only changes `assets/js/ai.js` — point `baseUrl()` at the Edge
Function and drop the `?API=` parameter.

## Approving companies (admin console)

`admin.html` is the staff side. It lists every registered company, approves
them, and is where you build each company's GPT.

### Make yourself an admin

Run `supabase/migrations/0003_admin.sql`, register through the dashboard like a
normal client, then run this once:

```sql
update public.companies set is_admin = true where email = 'info@genysisiq.com';
```

Sign out and back in. An **Admin console** link appears in your sidebar. Anyone
without the flag who opens `admin.html` gets a "staff access only" notice — the
RLS policies enforce it at the database, not just in the interface.

### Approving and building the GPT

1. Open **Admin console**. Pending companies are listed with an **Approve** button.
2. **Approve** flips them to `active`. If they have no system prompt yet, the
   editor opens automatically and tells you the assistant will not start
   without one.
3. In the editor set:
   - **Assistant name** — what the client sees above each reply
   - **Model** — defaults to `openai/gpt-oss-120b`
   - **System prompt** — the instructions that define their GPT. "Insert a
     starter template" gives you a structured skeleton to fill in.
   - **API key** / **customer ID** — optional, per-company overrides
4. **Test the prompt** sends a real request and shows how the assistant
   introduces itself, using the values currently in the form rather than what
   is saved. Iterate before committing.
5. **Save changes.** The client's dashboard picks it up on their next load.

A company needs **both** `status = 'active'` **and** a system prompt before the
chat appears for them. Either one missing and they see a "being set up" or
"almost ready" message instead of a broken chat.

### What admins can and cannot do

Admins can read and update every company row, and read conversations for
support. Clients remain locked to their own row, and a database trigger blocks
them from editing `status`, `system_prompt`, `ai_model`, `ai_api_key`,
`assistant_name`, `api_customer_id` or `is_admin` — so nobody can approve
themselves or rewrite their own assistant.

## File depot (Cloudflare R2)

Clients upload and download files from a **File depot** tab. Storage is an R2
bucket behind a Cloudflare Worker; a ready-to-deploy Worker is in
`cloudflare/worker.js`.

### Deploy it

```bash
cd cloudflare
npx wrangler login
npx wrangler r2 bucket create genysis-files
npx wrangler deploy
```

Then put the URL it prints into `assets/js/supabase-config.js`:

```js
FILES_API_BASE_URL: "https://genysis-files.<your-subdomain>.workers.dev",
```

**No JWT secret is needed.** This project signs tokens with ES256, so the
Worker verifies them against the public keys at
`{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (cached for ten minutes, with an
automatic refetch if a key rotates). `SUPABASE_URL` is already set in
`cloudflare/wrangler.toml` — keep it in step with the dashboard config.

A project still on the legacy HS256 shared secret is detected from the token
header and needs `npx wrangler secret put SUPABASE_JWT_SECRET` instead.

Edit `ALLOWED_ORIGINS` in `wrangler.toml` to match the sites that may call it.
Leave `FILES_API_BASE_URL` blank and the tab shows a "being set up" state —
which is exactly what it shows until you deploy.

### How isolation works

The Worker verifies the caller's Supabase JWT with your project's secret, takes
the user id from it, and prefixes **every** object key with that id. A company
physically cannot address another company's objects — key traversal (`..`) is
rejected, and downloads are always sent as attachments with `nosniff`, so
uploaded HTML can never execute on your origin.

Limit is 50 MB per file, set in both `cloudflare/worker.js` and
`assets/js/files.js` — change both together.

### The API

```
GET    {BASE}/files          -> { files: [{ key, name, size, type, uploaded }] }
POST   {BASE}/files          -> multipart form-data, field "file"
GET    {BASE}/files/{key}    -> the file
DELETE {BASE}/files/{key}    -> { ok: true }
```

All require `Authorization: Bearer <supabase access token>`.


## Session security

Two protections for shared or unattended machines.

### Sign out when the browser closes

A toggle under **Account -> Security**. When on, the session token is kept in
`sessionStorage` instead of `localStorage`, so closing the tab, quitting the
browser, or shutting the machine down ends the session. Refreshing keeps them
signed in. Toggling it migrates the existing token, so nobody is kicked out for
changing the setting.

Off by default — turn it on per account.

### Idle timeout

Always on. After **6 minutes** without interaction the client is signed out and
must sign in again. They get a 45-second warning with a live countdown and a
"Stay signed in" button first.

Mouse, keyboard, touch, scroll and focus all count as activity, and tabs
coordinate through `localStorage` — being active in one tab keeps the others
alive. Waking from sleep re-checks immediately rather than waiting.

Tune in `assets/js/supabase-config.js`:

```js
IDLE_TIMEOUT_MINUTES: 6,
IDLE_WARNING_SECONDS: 45
```

The timeout is floored at one minute regardless of what you set.


## How accounts work

| Field | Who sets it |
|---|---|
| `company_name`, `contact_name`, `phone`, `industry`, `website` | The client, on the Account page |
| `email` | Supabase, at signup |
| `status` | **Staff only** — `pending` → `active` → `suspended` |
| `api_customer_id` | **Staff only** — links them to the AI API |
| `system_prompt` | **Staff only** — the assistant's instructions |
| `assistant_name`, `ai_model`, `ai_api_key` | **Staff only** |

New signups land as `pending`. The dashboard tells them Genysis IQ is
provisioning their assistants and that they will be emailed when ready.

Approve them in the admin console rather than by hand. The SQL equivalent, if
you ever need it:

```sql
update public.companies
set status = 'active', system_prompt = '...'
where email = 'client@example.com';
```

---

## Notes

- Sessions persist and refresh automatically. Signing out in one tab signs out
  the others.
- Visiting `dashboard.html` without a session redirects to
  `login.html?next=dashboard.html` and returns there after signing in.
- The redirect target is restricted to same-site paths, so the `next` parameter
  cannot be used to bounce someone to another domain.
- If a profile row is ever missing (for example an account created before the
  migration ran), the dashboard creates it from the signup metadata.
- A "Client Login" link now sits in the main site navigation on all four public
  pages. Remove it from the `<nav class="nav-links">` block if you would rather
  the dashboard stay unlisted; `login.html` and `dashboard.html` are both
  `noindex` either way.
