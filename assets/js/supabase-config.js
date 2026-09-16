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
     Where the dashboard and the website chat widget send messages. This is our
     own proxy (api/chat.js), NOT DeepSeek.

     THERE IS NO API KEY IN THIS FILE, AND THERE MUST NEVER BE ONE. Everything
     here is downloaded by every visitor. The DeepSeek key is a Vercel
     environment variable, read only by the proxy:

       Vercel -> this project -> Settings -> Environment Variables
         DEEPSEEK_API_KEY        your pay-as-you-go key   (required)
         DEEPSEEK_SITE_API_KEY   separate key for the public widget (optional)

     "/api" means "this same website", which is correct on Vercel. Locally,
     run the site with `vercel dev` so /api exists - a plain static server such
     as `python3 -m http.server` does not run the proxy. */
  AI_API_BASE_URL: "/api",

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

  /* ------------------------------------------------------------- auth ----
     How long to wait on Supabase's auth service before giving up. Supabase
     can leave /auth/v1 accepting connections but never replying, which would
     otherwise hang the sign-in button forever. */
  AUTH_TIMEOUT_MS: 20000,

  /* --------------------------------------------------------- analytics ----
     First-party traffic measurement, written to our own Supabase project by
     assets/js/analytics.js. No cookies, no third-party script, no IP stored.
     Requires migration 0007_analytics.sql.

     Set ANALYTICS_ENABLED to false to switch tracking off site-wide without
     touching any HTML. ANALYTICS_TRACK_LOCALHOST lets you see your own test
     traffic in the console while developing - leave it false in production so
     local testing does not pollute the real numbers. */
  ANALYTICS_ENABLED: true,
  ANALYTICS_TRACK_LOCALHOST: false

  /* Reply length is no longer set here. The proxy owns it - see LIMITS at the
     top of api/chat.js - so a visitor cannot raise it. */
};
