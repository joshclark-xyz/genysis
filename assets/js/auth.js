/* =============================================================================
   Genysis IQ - shared authentication layer
   Wraps the Supabase client so pages never talk to it directly.
   ============================================================================= */

(function (global) {
  "use strict";

  var cfg = global.GENYSIS_CONFIG || {};
  var configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL.indexOf("YOUR_SUPABASE") === -1 &&
    cfg.SUPABASE_ANON_KEY.indexOf("YOUR_SUPABASE") === -1;

  var client = null;
  if (configured && global.supabase && global.supabase.createClient) {
    var auth = {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true   // handles the tokens in email-link hashes
    };

    /* session.js decides whether the token lands in localStorage (persistent)
       or sessionStorage (gone when the browser closes). */
    if (global.GenysisSession && global.GenysisSession.storage) {
      auth.storage = global.GenysisSession.storage;
    }

    client = global.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: auth });
  }

  /** Absolute URL for a page in this site, whatever origin we are served from. */
  function absolute(page) {
    return new URL(page, global.location.href).href;
  }

  /* --------------------------------------------------- error translation -- */

  var MESSAGES = {
    "invalid login credentials":
      "That email and password do not match. Check both and try again.",
    "email not confirmed":
      "Your email address has not been verified yet. Check your inbox for the verification link.",
    "user already registered":
      "An account already exists for that email. Try signing in instead.",
    "password should be at least 6 characters":
      "Please choose a password of at least 8 characters.",
    "unable to validate email address: invalid format":
      "That does not look like a valid email address.",
    "email rate limit exceeded":
      "Too many emails have been sent to that address. Please wait a few minutes and try again.",
    "for security purposes, you can only request this after":
      "Please wait a moment before requesting another email."
  };

  function humanize(error) {
    if (!error) return "Something went wrong. Please try again.";
    var raw = (error.message || String(error)).toLowerCase();
    for (var key in MESSAGES) {
      if (raw.indexOf(key) !== -1) return MESSAGES[key];
    }
    if (error.__timeout || raw.indexOf("auth-timeout") !== -1) {
      return "Our sign-in service is not responding right now. This is a problem on " +
             "our side, not with your details \u2014 please try again in a few minutes. " +
             "If it keeps happening, email info@genysisiq.com.";
    }
    if (raw.indexOf("failed to fetch") !== -1 || raw.indexOf("networkerror") !== -1) {
      return "Could not reach the server. Check your connection and try again.";
    }
    return error.message || "Something went wrong. Please try again.";
  }

  /* --------------------------------------------------------------- timeouts --
     Supabase's auth service can stop answering while the rest of the project
     stays healthy. A fetch to a service that accepts the connection but never
     replies hangs forever, and the promise simply never settles - which shows
     up as a "Signing in..." button that spins until the tab is closed.

     Every network-bound auth call is therefore raced against a timer, so a dead
     endpoint produces an honest error instead of an infinite spinner. */

  var AUTH_TIMEOUT_MS = Number(cfg.AUTH_TIMEOUT_MS || 20000);

  function withTimeout(promise, label) {
    var timer;
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        timer = setTimeout(function () {
          var err = new Error("auth-timeout");
          err.__timeout = label || "request";
          reject(err);
        }, AUTH_TIMEOUT_MS);
      })
    ]).then(
      function (v) { clearTimeout(timer); return v; },
      function (e) { clearTimeout(timer); throw e; }
    );
  }

  /* ------------------------------------------------------------- actions -- */

  function requireClient() {
    if (!client) {
      throw new Error(
        "Supabase is not configured yet. Add your project URL and anon key to " +
        "assets/js/supabase-config.js."
      );
    }
    return client;
  }

  var Auth = {
    isConfigured: function () { return !!client; },
    client: function () { return client; },
    humanize: humanize,

    signUp: function (details) {
      return withTimeout(requireClient().auth.signUp({
        email: details.email,
        password: details.password,
        options: {
          emailRedirectTo: absolute(cfg.REDIRECT_AFTER_VERIFY || "dashboard.html"),
          data: {
            company_name: details.companyName,
            contact_name: details.contactName,
            phone: details.phone || ""
          }
        }
      }), "sign up");
    },

    signIn: function (email, password) {
      return withTimeout(
        requireClient().auth.signInWithPassword({ email: email, password: password }),
        "sign in");
    },

    signOut: function () {
      return requireClient().auth.signOut();
    },

    resendVerification: function (email) {
      return withTimeout(requireClient().auth.resend({
        type: "signup",
        email: email,
        options: { emailRedirectTo: absolute(cfg.REDIRECT_AFTER_VERIFY || "dashboard.html") }
      }), "resend");
    },

    sendPasswordReset: function (email) {
      return withTimeout(
        requireClient().auth.resetPasswordForEmail(email, {
          redirectTo: absolute(cfg.REDIRECT_AFTER_RECOVERY || "update-password.html")
        }), "password reset");
    },

    updatePassword: function (password) {
      return withTimeout(requireClient().auth.updateUser({ password: password }),
                         "password update");
    },

    getSession: function () {
      return requireClient().auth.getSession();
    },

    onAuthChange: function (fn) {
      return requireClient().auth.onAuthStateChange(fn);
    },

    /* ------------------------------------------------------------ profile -- */

    getCompany: function (userId) {
      return requireClient()
        .from("companies")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
    },

    updateCompany: function (userId, fields) {
      return requireClient()
        .from("companies")
        .update(fields)
        .eq("id", userId)
        .select()
        .maybeSingle();
    },

    /* Used when the signup trigger has not run (e.g. the migration was applied
       after some accounts already existed). */
    createCompany: function (userId, fields) {
      var row = Object.assign({ id: userId }, fields);
      return requireClient().from("companies").insert(row).select().maybeSingle();
    },

    /** Redirect to the login page unless a valid session exists. */
    guard: function () {
      if (!client) {
        return Promise.resolve({ user: null, unconfigured: true });
      }
      return client.auth.getSession().then(function (res) {
        var session = res.data && res.data.session;
        if (!session) {
          var next = encodeURIComponent(
            global.location.pathname.split("/").pop() + global.location.search
          );
          global.location.replace("login.html?next=" + next);
          return { user: null };
        }
        return { user: session.user, session: session };
      });
    }
  };

  global.GenysisAuth = Auth;
})(window);
