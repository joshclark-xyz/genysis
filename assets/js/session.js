/* =============================================================================
   Genysis IQ - session security
   -----------------------------------------------------------------------------
   Must load BEFORE auth.js: it supplies the storage adapter the Supabase client
   is built with.

   Two protections, both aimed at shared or unattended machines:

   1. "Sign out when I close the browser" - the session token lives in
      sessionStorage instead of localStorage, so closing the tab or shutting
      the machine down ends it. Survives a refresh, not a close.

   2. Idle timeout - no interaction for N minutes signs the user out, with a
      warning first. Tabs coordinate through localStorage so activity in one
      counts for all of them.
   ============================================================================= */

(function (global) {
  "use strict";

  var cfg = global.GENYSIS_CONFIG || {};

  var PREF_KEY = "genysis.endOnClose";      // the preference itself always persists
  var ACTIVITY_KEY = "genysis.lastActive";  // shared across tabs
  var IDLE_MINUTES = Number(cfg.IDLE_TIMEOUT_MINUTES || 6);
  var WARN_SECONDS = Number(cfg.IDLE_WARNING_SECONDS || 45);

  var IDLE_MS = Math.max(1, IDLE_MINUTES) * 60 * 1000;
  var WARN_MS = Math.min(WARN_SECONDS * 1000, IDLE_MS - 5000);

  /* --------------------------------------------------------- preference -- */

  function endOnClose() {
    try { return localStorage.getItem(PREF_KEY) === "1"; } catch (e) { return false; }
  }

  function setEndOnClose(on) {
    try {
      if (on) localStorage.setItem(PREF_KEY, "1");
      else localStorage.removeItem(PREF_KEY);
    } catch (e) { /* private mode - the setting simply will not stick */ }
    migrate(on);
  }

  /* Move any existing Supabase token to the store the new setting implies, so
     toggling does not sign the person out. */
  function migrate(toSession) {
    try {
      var from = toSession ? localStorage : sessionStorage;
      var to = toSession ? sessionStorage : localStorage;
      var moved = [];
      for (var i = 0; i < from.length; i++) {
        var k = from.key(i);
        if (k && k.indexOf("sb-") === 0) moved.push(k);
      }
      moved.forEach(function (k) {
        to.setItem(k, from.getItem(k));
        from.removeItem(k);
      });
    } catch (e) { /* nothing we can do; the session just stays put */ }
  }

  /* ----------------------------------------------------------- storage --- */

  /**
   * Storage adapter handed to the Supabase client. Reads the preference on
   * every call so a toggle takes effect without a reload.
   */
  var storage = {
    getItem: function (key) {
      try {
        var primary = endOnClose() ? sessionStorage : localStorage;
        var value = primary.getItem(key);
        if (value !== null) return value;
        // Tolerate a token left in the other store (e.g. just after a toggle).
        var other = endOnClose() ? localStorage : sessionStorage;
        return other.getItem(key);
      } catch (e) { return null; }
    },
    setItem: function (key, value) {
      try { (endOnClose() ? sessionStorage : localStorage).setItem(key, value); }
      catch (e) { /* quota or private mode */ }
    },
    removeItem: function (key) {
      try { localStorage.removeItem(key); sessionStorage.removeItem(key); }
      catch (e) { /* nothing to clean up */ }
    }
  };

  /* -------------------------------------------------------- idle timeout -- */

  var timer = null, warnTimer = null, countdown = null, onExpire = null, armed = false;

  function stamp() {
    try { localStorage.setItem(ACTIVITY_KEY, String(Date.now())); } catch (e) {}
  }

  function lastActive() {
    try { return Number(localStorage.getItem(ACTIVITY_KEY)) || Date.now(); }
    catch (e) { return Date.now(); }
  }

  function clearTimers() {
    clearTimeout(timer); clearTimeout(warnTimer); clearInterval(countdown);
    timer = warnTimer = countdown = null;
  }

  function schedule() {
    clearTimers();
    if (!armed) return;
    var idleFor = Date.now() - lastActive();
    var toWarn = IDLE_MS - WARN_MS - idleFor;
    var toEnd = IDLE_MS - idleFor;

    if (toEnd <= 0) return expire();
    if (toWarn <= 0) { showWarning(Math.ceil(toEnd / 1000)); }
    else { warnTimer = setTimeout(function () { showWarning(Math.ceil(WARN_MS / 1000)); }, toWarn); }
    timer = setTimeout(expire, toEnd);
  }

  function activity() {
    if (!armed) return;
    if (dialog && !dialog.hidden) return;   // only the button dismisses the warning
    stamp();
    schedule();
  }

  function expire() {
    clearTimers();
    hideWarning();
    armed = false;
    if (typeof onExpire === "function") onExpire();
  }

  /* --------------------------------------------------------- warning UI -- */

  var dialog = null, countEl = null;

  function buildDialog() {
    if (dialog) return;
    dialog = document.createElement("div");
    dialog.className = "idle-shade";
    dialog.hidden = true;
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "idleTitle");
    dialog.innerHTML =
      '<div class="idle-box">' +
        '<span class="idle-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
          'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/>' +
          '<path d="M12 7v5l3 2"/></svg></span>' +
        '<h2 id="idleTitle">Still there?</h2>' +
        '<p>For your security we will sign you out in <b id="idleCount">45</b> seconds.</p>' +
        '<div class="idle-actions">' +
          '<button class="btn btn-primary" type="button" id="idleStay">Stay signed in</button>' +
          '<button class="btn btn-ghost" type="button" id="idleOut">Sign out now</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(dialog);
    countEl = dialog.querySelector("#idleCount");

    dialog.querySelector("#idleStay").addEventListener("click", function () {
      hideWarning();
      stamp();
      schedule();
    });
    dialog.querySelector("#idleOut").addEventListener("click", expire);
  }

  function showWarning(seconds) {
    buildDialog();
    dialog.hidden = false;
    countEl.textContent = seconds;
    dialog.querySelector("#idleStay").focus();

    clearInterval(countdown);
    countdown = setInterval(function () {
      seconds -= 1;
      countEl.textContent = Math.max(seconds, 0);
      if (seconds <= 0) clearInterval(countdown);
    }, 1000);
  }

  function hideWarning() {
    if (dialog) dialog.hidden = true;
    clearInterval(countdown);
  }

  /* ------------------------------------------------------------- public -- */

  var EVENTS = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "wheel", "focus"];
  var throttled = false;

  function onActivity() {
    if (throttled) return;
    throttled = true;
    setTimeout(function () { throttled = false; }, 1000);
    activity();
  }

  global.GenysisSession = {
    storage: storage,
    endOnClose: endOnClose,
    setEndOnClose: setEndOnClose,
    idleMinutes: IDLE_MINUTES,

    /** Begin watching for inactivity. `expiredFn` runs when the time is up. */
    startIdleWatch: function (expiredFn) {
      onExpire = expiredFn;
      armed = true;
      stamp();

      EVENTS.forEach(function (e) {
        global.addEventListener(e, onActivity, { passive: true, capture: true });
      });

      // Another tab seeing activity resets this one too.
      global.addEventListener("storage", function (e) {
        if (e.key === ACTIVITY_KEY && armed) { hideWarning(); schedule(); }
      });

      // Coming back from sleep or a background tab: re-check immediately.
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden && armed) schedule();
      });

      schedule();
    },

    stopIdleWatch: function () {
      armed = false;
      clearTimers();
      hideWarning();
    }
  };
})(window);
