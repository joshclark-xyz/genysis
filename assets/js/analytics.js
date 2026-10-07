/* =============================================================================
   Genysis IQ - first-party website analytics

   Records page views, how long a tab was actually *visible* on each page, how
   far people scrolled, and what they clicked. Everything goes to our own
   Supabase project through three security-definer RPCs - there is no
   third-party script here and no cookie, which is what lets privacy.html
   truthfully say we run no third-party analytics.

   The visitor id is a random uuid the browser generates for itself. It
   identifies a browser to this site and nothing else, and it never leaves
   localStorage except as that opaque value.
   ============================================================================= */

(function () {
  "use strict";

  var cfg = window.GENYSIS_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
  if (cfg.ANALYTICS_ENABLED === false) return;

  /* --------------------------------------------------------- don't track -- */

  // Headless browsers, crawlers, and anyone who asked not to be measured.
  // Our own uptime checks and Lighthouse runs would otherwise look like traffic.
  var ua = navigator.userAgent || "";
  if (navigator.webdriver) return;
  if (/bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|curl|wget/i.test(ua)) return;
  try { if (localStorage.getItem("gq_no_track") === "1") return; } catch (e) {}

  // Local development is noise in the real numbers. Flip this in the config if
  // you want to watch the console fill up while testing.
  var host = location.hostname;
  var isLocal = host === "localhost" || host === "127.0.0.1" || host === "" ||
                host.indexOf(".local") !== -1;
  if (isLocal && cfg.ANALYTICS_TRACK_LOCALHOST !== true) return;

  /* ---------------------------------------------------------------- ids --- */

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    // Pre-2021 Safari. Not cryptographically special, just needs to be unique.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // Visitor: sticky across visits, so we can tell new from returning.
  // Session: resets when the tab closes, so we can count sessions and bounces.
  function stored(store, key) {
    try {
      var v = store.getItem(key);
      if (!v) { v = uuid(); store.setItem(key, v); }
      return v;
    } catch (e) { return uuid(); }   // private mode / storage blocked
  }

  var visitorId = stored(window.localStorage, "gq_vid");
  var sessionId = stored(window.sessionStorage, "gq_sid");

  /* -------------------------------------------------------------- device -- */

  // A width of 0 is real - it happens in a backgrounded or still-laying-out tab.
  // Falling through to `< 768` there would file every one of those as a phone,
  // so fall back to the screen and only classify once we have a genuine number.
  var w = window.innerWidth || document.documentElement.clientWidth ||
          (window.screen && screen.width) || 0;
  var device = w <= 0 ? "desktop" : (w < 768 ? "mobile" : (w < 1100 ? "tablet" : "desktop"));

  /* ----------------------------------------------------------- transport -- */

  var rpc = cfg.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/";
  var headers = {
    "Content-Type": "application/json",
    apikey: cfg.SUPABASE_ANON_KEY,
    Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY
  };

  function call(fn, body, beacon) {
    // `keepalive` is what lets the final ping survive the page being closed.
    // sendBeacon cannot carry the apikey header, so it is no use to us here.
    return fetch(rpc + fn, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body || {}),
      keepalive: !!beacon,
      // Analytics must never delay or block anything the visitor is doing.
      priority: "low"
    }).then(function (res) {
      return res.ok ? res.json().catch(function () { return null; }) : null;
    }).catch(function () { return null; });   // offline, blocked, whatever - stay silent
  }

  /* -------------------------------------------------------- the pageview -- */

  var viewId = null;
  var queued = [];           // clicks that happened before the insert came back

  var path = location.pathname + (location.hash && location.hash.length > 1 ? "" : "");

  call("track_view", {
    p_visitor: visitorId,
    p_session: sessionId,
    p_path: path,
    p_title: document.title,
    p_referrer: document.referrer || null,
    p_device: device,
    p_screen_w: w
  }).then(function (id) {
    if (!id) return;
    viewId = typeof id === "string" ? id : String(id);
    queued.splice(0).forEach(function (e) { sendEvent(e[0], e[1], e[2]); });
    schedulePings();
  });

  /* ------------------------------------------------------- visible time --- */
  // Wall-clock time on a page is a lie - people leave tabs open for hours.
  // We accumulate only the milliseconds the tab was actually visible.

  var activeMs = 0;
  var lastTick = Date.now();
  var visible = document.visibilityState !== "hidden";

  function accrue() {
    var now = Date.now();
    if (visible) activeMs += now - lastTick;
    lastTick = now;
  }

  document.addEventListener("visibilitychange", function () {
    accrue();
    visible = document.visibilityState !== "hidden";
    if (!visible) flush(true);         // they may never come back - save now
  });

  /* ------------------------------------------------------- scroll depth --- */

  var maxScroll = 0;
  var scrollPending = false;

  function measureScroll() {
    scrollPending = false;
    var doc = document.documentElement;
    var reach = window.scrollY + window.innerHeight;
    var full = Math.max(doc.scrollHeight, document.body.scrollHeight);
    if (full <= 0) return;
    var pct = Math.round((reach / full) * 100);
    if (pct > maxScroll) maxScroll = Math.min(100, pct);
  }

  window.addEventListener("scroll", function () {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(measureScroll);
  }, { passive: true });

  measureScroll();

  /* --------------------------------------------------------------- pings -- */

  var pingTimer = null;
  var lastSent = -1;

  function flush(beacon) {
    accrue();
    if (!viewId) return;
    var seconds = Math.round(activeMs / 1000);
    // Don't spend a request saying the same thing twice.
    if (seconds === lastSent && !beacon) return;
    lastSent = seconds;
    call("track_ping", { p_view: viewId, p_ms: activeMs, p_scroll: maxScroll }, beacon);
  }

  function schedulePings() {
    flush(false);
    // Every 15s. Frequent enough that "live now" and time-on-page stay honest,
    // rare enough to be invisible on the network tab.
    pingTimer = setInterval(function () { if (visible) flush(false); }, 15000);
  }

  // pagehide fires reliably on mobile Safari where unload does not.
  window.addEventListener("pagehide", function () {
    if (pingTimer) clearInterval(pingTimer);
    flush(true);
  });

  /* -------------------------------------------------------------- clicks -- */

  function labelFor(el) {
    var a = el.getAttribute("aria-label");
    if (a) return a.trim();
    var t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (t) return t.slice(0, 120);
    var img = el.querySelector("img[alt]");
    if (img) return img.getAttribute("alt").trim().slice(0, 120);
    return el.getAttribute("title") || el.className || el.tagName.toLowerCase();
  }

  function kindFor(el, href) {
    if (!href) return "click";
    if (href.indexOf("tel:") === 0) return "call";
    if (href.indexOf("mailto:") === 0) return "email";
    if (el.classList.contains("btn-primary") || el.closest(".cta-band, .hero-actions")) return "cta";
    if (/^https?:\/\//i.test(href) && href.indexOf(location.host) === -1) return "outbound";
    return "click";
  }

  function sendEvent(kind, label, href) {
    if (!viewId) { if (queued.length < 25) queued.push([kind, label, href]); return; }
    // keepalive on every event, not just the unload ping: clicking a link starts
    // a navigation, and a plain fetch is cancelled the moment the page tears
    // down. Without this we would lose exactly the clicks that matter most -
    // the ones that took somebody somewhere.
    call("track_event", { p_view: viewId, p_kind: kind, p_label: label, p_href: href }, true);
  }

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest && ev.target.closest("a[href], button, [data-track]");
    if (!el) return;
    // The cookie-free equivalent of "don't measure me" for a single control.
    if (el.hasAttribute("data-no-track")) return;

    var href = el.getAttribute("href") || null;
    var label = el.getAttribute("data-track") || labelFor(el);
    sendEvent(kindFor(el, href), label, href);
  }, true);   // capture, so a handler that stops propagation cannot hide the click

  // Form submissions are the conversion that actually matters.
  document.addEventListener("submit", function (ev) {
    var f = ev.target;
    if (!f || f.hasAttribute("data-no-track")) return;
    sendEvent("form", f.getAttribute("id") || f.getAttribute("name") || "form", null);
  }, true);

  /* ------------------------------------------------------------- opt out -- */
  // For the team: run `GenysisAnalytics.optOut()` in the console on any browser
  // that should stop appearing in the numbers - your own, for instance.
  window.GenysisAnalytics = {
    optOut: function () {
      try { localStorage.setItem("gq_no_track", "1"); } catch (e) {}
      return "This browser will no longer be counted.";
    },
    optIn: function () {
      try { localStorage.removeItem("gq_no_track"); } catch (e) {}
      return "This browser is being counted again.";
    },
    visitorId: visitorId
  };
})();
