/* =============================================================================
   Genysis IQ - AI proxy (Vercel Serverless Function)
   -----------------------------------------------------------------------------
   POST /api/chat

   Sits between the browser and DeepSeek so the API key never reaches a
   visitor. The key lives in a Vercel environment variable and is read here.

   Hiding the key is only half the job. Once this URL exists it spends the
   DeepSeek balance for anyone who can reach it, so this function also owns
   the things a browser must not be trusted with:

     * the system prompt  - loaded from the database, or fixed in this file for
                            the public widget; never taken from the request
                            unless the caller is allowed to author one
     * the model          - checked against an allowlist
     * the length         - message, history and reply are all capped

   Two modes:

     mode: "dashboard"   Signed-in client or staff. Requires the Supabase access
                         token as `Authorization: Bearer <token>`. Uses the
                         company's saved system_prompt and model.

     mode: "site"        The public chat widget on the marketing pages. No
                         login. Uses the fixed SITE_SYSTEM_PROMPT below.

   ENVIRONMENT VARIABLES (Vercel -> Project -> Settings -> Environment Variables)

     DEEPSEEK_API_KEY        required. Your pay-as-you-go key.
     DEEPSEEK_SITE_API_KEY   optional. A separate key for the public widget, so
                             it can be revoked without affecting clients.
                             Falls back to DEEPSEEK_API_KEY.
     SUPABASE_URL            optional. Defaults to this project's URL.
     SUPABASE_ANON_KEY       optional. Defaults to this project's anon key.
     ALLOWED_ORIGINS         optional. Comma-separated. Defaults to the
                             genysisiq.com domains, localhost and *.vercel.app.
   ============================================================================= */

"use strict";

/* ------------------------------------------------------------------ config -- */

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// Public values - the same ones already served in assets/js/supabase-config.js.
const DEFAULT_SUPABASE_URL = "https://dkxuuczaliwmvixqhadw.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreHV1Y3phbGl3bXZpeHFoYWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NzMxMTcsImV4cCI6MjEwMzE0OTExN30.bd65SRwZQu2JcDl6uRsaf_F-kA1hq5ZulWgdtDZK9oc";

const ALLOWED_MODELS = ["deepseek-flash", "deepseek-v4-pro"];
const DEFAULT_MODEL = "deepseek-flash";

const LIMITS = {
  dashboard: { messageChars: 8000, historyTurns: 24, turnChars: 12000, maxTokens: 1024 },
  site:      { messageChars: 1000, historyTurns: 8,  turnChars: 2000,  maxTokens: 700 },
  promptChars: 20000
};

/* Best-effort abuse brake, per warm instance. Vercel runs several instances and
   recycles them, so this is NOT a real global rate limit - it stops a naive
   loop hammering one instance. A hard ceiling belongs in the DeepSeek console
   as a spending limit, and a true global limit needs Vercel KV or Upstash. */
const RATE = {
  site:      { windowMs: 60000, max: 12 },
  dashboard: { windowMs: 60000, max: 40 }
};

const SITE_SYSTEM_PROMPT = [
  "You are the assistant on the Genysis IQ website. Genysis IQ is a business",
  "consultancy in Orlando, Florida, serving clients across the United States.",
  "Its tagline is \"Where Intelligent Business Scaling Begins\".",
  "",
  "WHO RUNS IT",
  "- Ron Clark, Founder and CEO. 39 years in business, four companies built,",
  "  two with international operations. Created the CASPER framework. An",
  "  award-winning author on AI with executive education from MIT, Wharton and",
  "  the London School of Economics.",
  "- Josh Clark, AI and Technology Director. Handles the technology and AI side.",
  "",
  "WHAT THEY DO",
  "1. Business scaling and architecture - finding the real growth bottleneck,",
  "   reducing owner dependency, role clarity, decision rights, operating rhythm.",
  "2. Systems, processes and SOPs - turning knowledge held in people's heads",
  "   into repeatable, documented workflows, KPIs and scorecards.",
  "3. Sales and customer growth - sales process design, staff training, lead",
  "   handling, customer journey, referral and retention.",
  "4. Practical AI strategy - AI opportunity assessment, conversational AI,",
  "   workflow automation, penetration testing and security assessment, vendor",
  "   evaluation and implementation.",
  "5. Digital presence and discoverability - website conversion, SEO, local and",
  "   AI search, content architecture, Google Business Profile.",
  "",
  "THE CASPER FRAMEWORK",
  "Clarity, Architecture, Systems, Processes, Evaluation, Replication. Six",
  "stages taking a company from understanding its constraint to repeatable",
  "execution that does not depend on the owner.",
  "",
  "HOW TO ANSWER",
  "- Be brief and concrete. Two or three sentences is usually plenty.",
  "- You are a first point of contact, not the consultant. Do not invent",
  "  prices, timelines, guarantees or case studies. Genysis IQ has not",
  "  published pricing - if asked, say it depends on scope and point them to a",
  "  conversation.",
  "- When someone is ready to talk, give them the phone number 689.388.7353",
  "  (answered 24 hours a day, and it can book appointments) or the contact page.",
  "- Only discuss Genysis IQ and its services. If asked for anything unrelated -",
  "  writing, coding, general knowledge - politely decline and redirect to how",
  "  Genysis IQ can help. This keeps the assistant from being used as a free",
  "  general-purpose AI.",
  "- Never claim to be human. You are the Genysis IQ website assistant."
].join("\n");

/* ------------------------------------------------------------------ helpers -- */

function env(name, fallback) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : fallback;
}

function send(res, status, body, extraHeaders) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  }
  res.end(JSON.stringify(body));
}

function fail(res, status, code, message, extraHeaders) {
  send(res, status, { error: { code, message } }, extraHeaders);
}

function allowedOrigins() {
  const configured = env("ALLOWED_ORIGINS", "");
  if (configured) {
    return configured.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [
    "https://genysisiq.com",
    "https://www.genysisiq.com",
    "http://localhost:3000",
    "http://localhost:8931"
  ];
}

/* Browsers always send Origin on a cross-origin POST, and on same-origin POSTs
   in current engines. A non-browser client can forge it, so this is a filter
   against casual embedding, not a security boundary - the prompt lock and caps
   are what actually bound the damage. */
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;               // same-origin navigations / server calls
  if (allowedOrigins().includes(origin)) return true;
  // Vercel preview deployments of this project.
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

const buckets = new Map();

function rateLimited(key, mode) {
  const { windowMs, max } = RATE[mode];
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
  // Keep the map from growing without bound on a long-lived instance.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
    }
  }
  return hits.length > max;
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.headers["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "unknown";
}

async function readJson(req) {
  // Vercel pre-parses JSON bodies; fall back to reading the stream ourselves.
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/** Keeps only well-formed user/assistant turns, trimmed to the mode's limits. */
function cleanHistory(history, limits) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-limits.historyTurns)
    .map((m) => ({ role: m.role, content: m.content.slice(0, limits.turnChars) }));
}

/** Reads the JWT payload without verifying it - only to learn which row to ask
    for. The signature IS verified: PostgREST checks it when we query with the
    token, and rejects a forged or expired one. */
function tokenSubject(token) {
  try {
    const part = token.split(".")[1];
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const sub = JSON.parse(json).sub;
    return typeof sub === "string" && /^[0-9a-f-]{36}$/i.test(sub) ? sub : null;
  } catch (e) {
    return null;
  }
}

/** The caller's own companies row, fetched as the caller so RLS applies. */
async function loadCompany(token) {
  const sub = tokenSubject(token);
  if (!sub) return { status: 401 };

  const url =
    env("SUPABASE_URL", DEFAULT_SUPABASE_URL).replace(/\/+$/, "") +
    "/rest/v1/companies?id=eq." + sub +
    "&select=id,status,is_admin,can_self_serve_gpt,system_prompt,ai_model,ai_api_key";

  const r = await fetch(url, {
    headers: {
      apikey: env("SUPABASE_ANON_KEY", DEFAULT_SUPABASE_ANON_KEY),
      Authorization: "Bearer " + token,
      Accept: "application/json"
    }
  });

  if (r.status === 401 || r.status === 403) return { status: 401 };
  if (!r.ok) return { status: 502 };

  const rows = await r.json();
  if (!Array.isArray(rows) || !rows[0]) return { status: 403 };
  return { status: 200, company: rows[0] };
}

/* ------------------------------------------------------------ build request -- */

async function planDashboard(req, body, res) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    fail(res, 401, "not_signed_in", "Please sign in again.");
    return null;
  }

  const found = await loadCompany(token);
  if (found.status === 401) {
    fail(res, 401, "session_expired", "Your session has expired. Please sign in again.");
    return null;
  }
  if (found.status !== 200) {
    fail(res, found.status === 403 ? 403 : 502, "no_company",
      "We could not load your company profile. Please try again.");
    return null;
  }

  const c = found.company;
  const isAdmin = c.is_admin === true;
  const canAuthor = isAdmin || c.can_self_serve_gpt === true;
  const limits = LIMITS.dashboard;

  if (!isAdmin && c.status !== "active") {
    fail(res, 403, "not_active", "Your account has not been activated yet.");
    return null;
  }

  // A draft is an unsaved prompt being tested before it is saved. Only people
  // allowed to author prompts may test one - otherwise this endpoint would be
  // a free general-purpose AI on your balance.
  let systemPrompt = c.system_prompt;
  let model = c.ai_model;
  let key = c.ai_api_key;

  if (body.draft && typeof body.draft === "object") {
    if (!canAuthor) {
      fail(res, 403, "cannot_author", "Your account is not permitted to write its own assistant.");
      return null;
    }
    if (typeof body.draft.systemPrompt === "string") systemPrompt = body.draft.systemPrompt;
    if (typeof body.draft.model === "string") model = body.draft.model;
    // Only staff may test a specific key typed into the admin form.
    if (isAdmin && typeof body.draft.apiKey === "string" && body.draft.apiKey.trim()) {
      key = body.draft.apiKey.trim();
    }
  }

  if (!systemPrompt || !String(systemPrompt).trim()) {
    fail(res, 409, "no_prompt",
      "This assistant has not been set up yet. Genysis IQ will let you know when it is ready.");
    return null;
  }

  return {
    rateKey: "d:" + c.id,
    key: key || env("DEEPSEEK_API_KEY", ""),
    model: ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL,
    systemPrompt: String(systemPrompt).slice(0, LIMITS.promptChars),
    limits
  };
}

function planSite(req) {
  return {
    rateKey: "s:" + clientIp(req),
    key: env("DEEPSEEK_SITE_API_KEY", env("DEEPSEEK_API_KEY", "")),
    model: DEFAULT_MODEL,
    systemPrompt: SITE_SYSTEM_PROMPT,
    limits: LIMITS.site
  };
}

/* ------------------------------------------------------------------ handler -- */

async function handler(req, res) {
  if (req.method === "GET") {
    // Lightweight status for the dashboard - reports configuration, never the key.
    return send(res, 200, { ok: true, configured: Boolean(env("DEEPSEEK_API_KEY", "")) });
  }
  if (req.method !== "POST") {
    return fail(res, 405, "method_not_allowed", "Use POST.", { Allow: "GET, POST" });
  }
  if (!originAllowed(req)) {
    return fail(res, 403, "origin_not_allowed", "This origin is not permitted.");
  }

  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return fail(res, 400, "bad_json", "The request body was not valid JSON.");
  }

  const mode = body.mode === "site" ? "site" : body.mode === "dashboard" ? "dashboard" : null;
  if (!mode) {
    return fail(res, 400, "bad_mode", "mode must be \"dashboard\" or \"site\".");
  }

  const plan = mode === "site" ? planSite(req) : await planDashboard(req, body, res);
  if (!plan) return; // planDashboard already responded

  if (!plan.key) {
    return fail(res, 503, "not_configured",
      "The assistant is not connected yet. Please try again later.");
  }

  if (rateLimited(plan.rateKey, mode)) {
    return fail(res, 429, "rate_limited",
      "You are sending messages too quickly. Please wait a moment.", { "Retry-After": "20" });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return fail(res, 400, "empty_message", "Please type a message.");
  }
  if (message.length > plan.limits.messageChars) {
    return fail(res, 413, "message_too_long", "That message is too long. Please shorten it.");
  }

  const messages = [{ role: "system", content: plan.systemPrompt }]
    .concat(cleanHistory(body.history, plan.limits))
    .concat([{ role: "user", content: message }]);

  const wantsStream = mode === "dashboard" && body.stream === true;

  let upstream;
  try {
    upstream = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + plan.key
      },
      body: JSON.stringify({
        model: plan.model,
        messages,
        max_tokens: plan.limits.maxTokens,
        temperature: mode === "site" ? 0.6 : 0.7,
        reasoning_effort: "low",
        stream: wantsStream
      })
    });
  } catch (e) {
    return fail(res, 502, "upstream_unreachable", "The assistant is temporarily unavailable.");
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    // Never forward DeepSeek's raw error: it can echo request details.
    const status = upstream.status;
    const retryAfter = upstream.headers.get("retry-after");
    const headers = retryAfter ? { "Retry-After": retryAfter } : undefined;

    if (status === 401 || status === 403) {
      console.error("[api/chat] DeepSeek rejected the key:", status, text.slice(0, 200));
      return fail(res, 502, "provider_auth", "The assistant is not connected correctly. Genysis IQ has been notified.");
    }
    if (status === 402) {
      console.error("[api/chat] DeepSeek balance exhausted:", text.slice(0, 200));
      return fail(res, 503, "provider_balance", "The assistant is temporarily unavailable.");
    }
    if (status === 400) {
      console.error("[api/chat] DeepSeek rejected the request:", text.slice(0, 300));
      return fail(res, 502, "provider_rejected", "The assistant could not process that request.");
    }
    if (status === 429) {
      return fail(res, 429, "provider_busy", "The assistant is busy. Please try again in a moment.", headers);
    }
    return fail(res, 502, "provider_error", "The assistant is temporarily unavailable.", headers);
  }

  if (!wantsStream) {
    const data = await upstream.json().catch(() => null);
    const choice = data && data.choices && data.choices[0];
    const content = choice && choice.message && choice.message.content;
    if (!content || !String(content).trim()) {
      return fail(res, 502, "empty_reply", "The assistant returned an empty reply. Please try again.");
    }
    // Hand back only what the client renders - never the reasoning trace.
    return send(res, 200, {
      content: String(content).trim(),
      finishReason: choice.finish_reason || null
    });
  }

  // Stream DeepSeek's SSE straight through. The client already strips
  // delta.reasoning_content, so the private thinking is never displayed.
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("X-Accel-Buffering", "no");

  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch (e) {
    console.error("[api/chat] stream interrupted:", e && e.message);
  } finally {
    res.end();
  }
}

module.exports = handler;
// Thinking-mode replies can take a while; give the function room to finish.
module.exports.config = { maxDuration: 60 };

// Exposed for the local test harness only.
module.exports._internal = { tokenSubject, cleanHistory, originAllowed, rateLimited, buckets, SITE_SYSTEM_PROMPT };
