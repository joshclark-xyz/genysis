# Genysis IQ file depot — Cloudflare Worker

Backs the **File depot** tab in the client dashboard with an R2 bucket.

## Deploy

```bash
cd cloudflare
npx wrangler login
npx wrangler r2 bucket create genysis-files
npx wrangler deploy
```

`wrangler deploy` prints a URL like
`https://genysis-files.<subdomain>.workers.dev`. Put it in
`assets/js/supabase-config.js`:

```js
FILES_API_BASE_URL: "https://genysis-files.<subdomain>.workers.dev",
```

Reload the dashboard and the File depot goes live.

## Authentication

The Worker verifies the caller's Supabase JWT before touching R2.

This project signs tokens with **ES256**, so the Worker fetches the public keys
from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` and caches them for ten
minutes. **No secret is required.** `SUPABASE_URL` in `wrangler.toml` is all it
needs.

If you ever switch the project back to the legacy HS256 shared secret, the
Worker detects that from the token header and instead needs:

```bash
npx wrangler secret put SUPABASE_JWT_SECRET
```

## Isolation

Every object key is prefixed with the caller's user id, taken from the verified
token — never from anything the browser sent. One company cannot address
another's files even by guessing keys. Keys containing `..` or null bytes are
rejected outright.

Downloads are always returned as `Content-Disposition: attachment` with
`X-Content-Type-Options: nosniff`, so an uploaded HTML or SVG file can never
execute against your origin.

## Limits

50 MB per file, enforced in both `worker.js` (`MAX_BYTES`) and
`assets/js/files.js`. Change both together.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/files` | List the caller's files |
| `POST` | `/files` | Upload (multipart, field `file`) |
| `GET` | `/files/{key}` | Download |
| `DELETE` | `/files/{key}` | Delete |

All require `Authorization: Bearer <supabase access token>`.
