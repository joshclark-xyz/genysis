/* =============================================================================
   Genysis IQ dashboard - configuration
   -----------------------------------------------------------------------------
   Fill in the two values below from the Supabase dashboard:
     Project Settings -> Data API -> Project URL
     Project Settings -> API Keys  -> anon / publishable key

   The publishable key is designed to be visible in the browser. It is NOT a
   secret. Row Level Security is what protects the data - never put the
   service_role key in this file.
   ============================================================================= */

window.GENYSIS_CONFIG = {
  SUPABASE_URL: "https://dkxuuczaliwmvixqhadw.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRreHV1Y3phbGl3bXZpeHFoYWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NzMxMTcsImV4cCI6MjEwMzE0OTExN30.bd65SRwZQu2JcDl6uRsaf_F-kA1hq5ZulWgdtDZK9oc",

  /* Where Supabase sends people after they click the link in a verification
     email. Left blank, it resolves against whatever origin the page is served
     from, so localhost and production both work without edits. */
  REDIRECT_AFTER_VERIFY: "dashboard.html",
  REDIRECT_AFTER_RECOVERY: "update-password.html",

  /* ---------------------------------------------------------- AI endpoint --
     The Genysis IQ chat API. The dashboard posts to
     {AI_API_BASE_URL}/v1/ai/chat?API={key}

     AI_API_KEY is the fallback key, used when a company has no key of its own
     in the `ai_api_key` column. Anything here is visible to any signed-in
     client in the browser's network tab - see the security note in
     DASHBOARD-SETUP.md before using a production key. Per-company keys stored
     in Supabase are the better option, since a client can then only ever see
     their own.

     Leave both blank and the dashboard shows an honest "being set up" state
     instead of erroring. */
  AI_API_BASE_URL: "https://api.wsgpolar.me",
  AI_API_KEY: "api_test123",

  /* ------------------------------------------------------------- files ----
     The Cloudflare Worker in front of the R2 bucket. A ready-to-deploy Worker
     is in cloudflare/worker.js. Leave blank and the Files tab shows a
     "not connected" state instead of erroring. */
  FILES_API_BASE_URL: "https://genysis-files.beluga7133.workers.dev",

  /* ----------------------------------------------------------- session ----
     Minutes of inactivity before a client is signed out, and how many seconds
     of warning they get first. */
  IDLE_TIMEOUT_MINUTES: 6,
  IDLE_WARNING_SECONDS: 45,

  /* Longest reply the assistant may produce, in tokens.

     This is the main lever on how many people can chat at once. The provider
     bills a tokens-per-minute budget shared by every client on the account, so
     a smaller cap means more simultaneous conversations fit inside it - at the
     cost of truncating long answers. 1024 suits detailed replies; drop to
     500-700 if 429s are frequent and answers are usually short. */
  /* --------------------------------------------------------- analytics ----
     First-party traffic measurement, written to our own Supabase project by
     assets/js/analytics.js. No cookies, no third-party script, no IP stored.
     Requires migration 0007_analytics.sql.

     Set ANALYTICS_ENABLED to false to switch tracking off site-wide without
     touching any HTML. ANALYTICS_TRACK_LOCALHOST lets you see your own test
     traffic in the console while developing - leave it false in production so
     local testing does not pollute the real numbers. */
  /* ------------------------------------------------------------- auth ----
     How long to wait on Supabase's auth service before giving up. Supabase
     can leave /auth/v1 accepting connections but never replying, which would
     otherwise hang the sign-in button forever. */
  AUTH_TIMEOUT_MS: 20000,

  ANALYTICS_ENABLED: true,
  ANALYTICS_TRACK_LOCALHOST: false,

  AI_MAX_TOKENS: 1024
};
