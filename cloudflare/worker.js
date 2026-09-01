/**
 * Genysis IQ - file depot Worker
 * =============================================================================
 * Sits between the client dashboard and an R2 bucket.
 *
 * Every request must carry a Supabase access token. The Worker verifies it,
 * pulls the user id out, and prefixes every object key with that id — so a
 * company can only ever see and touch its own files, no matter what it asks
 * for. Key traversal is blocked explicitly as well.
 *
 * Deploy:
 *   cd cloudflare
 *   # set SUPABASE_URL in wrangler.toml first
 *   npx wrangler deploy
 *
 * Tokens signed with ES256/RS256 (the current Supabase default) are verified
 * against the project's public JWKS - no secret needed. Only a project still
 * using the legacy HS256 secret needs:
 *   npx wrangler secret put SUPABASE_JWT_SECRET
 *
 * Then put the deployed URL in assets/js/supabase-config.js as FILES_API_BASE_URL.
 */

const MAX_BYTES = 50 * 1024 * 1024;   // keep in step with assets/js/files.js

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const user = await requireUser(request, env);
      const url = new URL(request.url);
      const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");

      if (parts[0] !== "files") return json({ error: "Not found" }, 404, cors);

      const key = parts.length > 1 ? decodeURIComponent(parts.slice(1).join("/")) : null;

      if (request.method === "GET" && !key) return listFiles(env, user, cors);
      if (request.method === "POST" && !key) return uploadFile(request, env, user, cors);
      if (request.method === "GET" && key) return getFile(env, user, key, cors);
      if (request.method === "DELETE" && key) return deleteFile(env, user, key, cors);

      return json({ error: "Method not allowed" }, 405, cors);
    } catch (err) {
      const status = err.status || 500;
      return json({ error: err.message || "Server error" }, status, cors);
    }
  }
};

/* ----------------------------------------------------------------- auth -- */

/* Supabase signs project JWTs with either:
 *   ES256/RS256 - asymmetric, public keys published at the project's JWKS
 *                 endpoint. This is the default for current projects.
 *   HS256       - a shared secret (legacy "JWT Secret").
 * Both are supported; the token's own header decides which path runs. */

let jwksCache = { keys: null, fetchedAt: 0 };
const JWKS_TTL_MS = 10 * 60 * 1000;

async function getJwks(env, force) {
  const fresh = jwksCache.keys && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  if (fresh && !force) return jwksCache.keys;

  if (!env.SUPABASE_URL) {
    throw httpError(500, "SUPABASE_URL is not set on the Worker");
  }

  const res = await fetch(
    env.SUPABASE_URL.replace(/\/+$/, "") + "/auth/v1/.well-known/jwks.json"
  );
  if (!res.ok) throw httpError(500, "Could not fetch the project's signing keys");

  const body = await res.json();
  jwksCache = { keys: body.keys || [], fetchedAt: Date.now() };
  return jwksCache.keys;
}

const ALG = {
  ES256: { importAlg: { name: "ECDSA", namedCurve: "P-256" }, verifyAlg: { name: "ECDSA", hash: "SHA-256" } },
  RS256: { importAlg: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, verifyAlg: { name: "RSASSA-PKCS1-v1_5" } }
};

async function verifyAsymmetric(env, header, signingInput, signature) {
  const spec = ALG[header.alg];
  if (!spec) throw httpError(401, `Unsupported token algorithm: ${header.alg}`);

  let keys = await getJwks(env, false);
  let jwk = keys.find((k) => k.kid === header.kid);

  // Key rotated since we last looked - refetch once before giving up.
  if (!jwk) {
    keys = await getJwks(env, true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw httpError(401, "Token was signed with an unknown key");

  const key = await crypto.subtle.importKey("jwk", jwk, spec.importAlg, false, ["verify"]);
  return crypto.subtle.verify(spec.verifyAlg, key, signature, signingInput);
}

async function verifyHmac(env, signingInput, signature) {
  if (!env.SUPABASE_JWT_SECRET) {
    throw httpError(500, "SUPABASE_JWT_SECRET is not set on the Worker");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.SUPABASE_JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify("HMAC", key, signature, signingInput);
}

/** Verifies the Supabase JWT and returns its payload. */
async function requireUser(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) throw httpError(401, "Missing access token");

  const [headB64, bodyB64, sigB64] = token.split(".");
  if (!headB64 || !bodyB64 || !sigB64) throw httpError(401, "Malformed token");

  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(headB64)));
  } catch (e) {
    throw httpError(401, "Malformed token header");
  }

  const signingInput = new TextEncoder().encode(`${headB64}.${bodyB64}`);
  const signature = b64urlToBytes(sigB64);

  const ok = header.alg === "HS256"
    ? await verifyHmac(env, signingInput, signature)
    : await verifyAsymmetric(env, header, signingInput, signature);

  if (!ok) throw httpError(401, "Invalid token");

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(bodyB64)));
  } catch (e) {
    throw httpError(401, "Malformed token payload");
  }

  if (payload.exp && Date.now() / 1000 > payload.exp) throw httpError(401, "Token expired");
  if (!payload.sub) throw httpError(401, "Token has no subject");
  if (payload.role && payload.role === "anon") throw httpError(401, "Sign in required");

  return payload;
}

/* --------------------------------------------------------------- routes -- */

async function listFiles(env, user, cors) {
  const prefix = `${user.sub}/`;
  const listed = await env.FILES.list({ prefix, include: ["httpMetadata", "customMetadata"] });

  const files = listed.objects.map((o) => ({
    key: o.key.slice(prefix.length),
    name: (o.customMetadata && o.customMetadata.name) || o.key.slice(prefix.length),
    size: o.size,
    type: (o.httpMetadata && o.httpMetadata.contentType) || "application/octet-stream",
    uploaded: o.uploaded
  }));

  files.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
  return json({ files }, 200, cors);
}

/* The dashboard hides the uploader without permission, but that is only the
 * interface. Ask the database directly so a hand-crafted POST cannot bypass it.
 * Uses the caller's own token, so RLS limits the read to their own row. */
async function canUpload(request, env, user) {
  if (!env.SUPABASE_URL) throw httpError(500, "SUPABASE_URL is not set on the Worker");

  const token = (request.headers.get("Authorization") || "").slice(7).trim();
  const url = env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/companies?id=eq." + encodeURIComponent(user.sub) +
    "&select=can_upload_files";

  const res = await fetch(url, {
    headers: {
      "Authorization": "Bearer " + token,
      "apikey": env.SUPABASE_ANON_KEY || "",
      "Accept": "application/json"
    }
  });

  if (!res.ok) throw httpError(502, "Could not verify upload permission");

  const rows = await res.json();
  return !!(rows && rows[0] && rows[0].can_upload_files);
}

async function uploadFile(request, env, user, cors) {
  if (!(await canUpload(request, env, user))) {
    throw httpError(403,
      "Uploading is not enabled for this account. Contact Genysis IQ to request access.");
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") throw httpError(400, "No file supplied");
  if (file.size > MAX_BYTES) throw httpError(413, "File too large");

  const safe = safeName(file.name || "upload");
  const key = `${user.sub}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safe}`;

  await env.FILES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
    customMetadata: { name: safe, uploadedBy: user.email || user.sub }
  });

  return json({
    file: {
      key: key.slice(`${user.sub}/`.length),
      name: safe,
      size: file.size,
      type: file.type || "application/octet-stream",
      uploaded: new Date().toISOString()
    }
  }, 201, cors);
}

async function getFile(env, user, key, cors) {
  const object = await env.FILES.get(scoped(user, key));
  if (!object) throw httpError(404, "File not found");

  const headers = new Headers(cors);
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "private, max-age=0, must-revalidate");
  // Never render user content inline - it would run in our own origin.
  headers.set("Content-Disposition",
    `attachment; filename="${(object.customMetadata && object.customMetadata.name) || "download"}"`);
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(object.body, { headers });
}

async function deleteFile(env, user, key, cors) {
  await env.FILES.delete(scoped(user, key));
  return json({ ok: true }, 200, cors);
}

/* --------------------------------------------------------------- helpers -- */

/** Forces the key inside this user's prefix and refuses traversal. */
function scoped(user, key) {
  const clean = String(key).replace(/^\/+/, "");
  if (clean.includes("..") || clean.includes("\0")) throw httpError(400, "Invalid key");
  return `${user.sub}/${clean}`;
}

function safeName(name) {
  return String(name)
    .replace(/[\\/\0]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "upload";
}

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.length === 0 || allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok && origin ? origin : (allowed[0] || "*"),
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
