/* =============================================================================
   Genysis IQ - website traffic, live

   Reads the aggregates in migration 0007 and keeps them current without the
   page ever being refreshed. Two mechanisms, deliberately:

     1. Supabase Realtime. Every insert into page_views / page_events wakes us
        immediately, so the live counter and the activity feed move the moment
        somebody clicks something.
     2. A 20-second poll. Realtime can be switched off in the project, a proxy
        can eat the websocket, and laptops suspend. The poll means the numbers
        are never more than 20 seconds stale even when the socket is gone.

   Realtime evaluates the RLS policies per subscriber, so an ordinary client
   signed into the dashboard receives nothing at all from these tables.
   ============================================================================= */

(function () {
  "use strict";

  var Auth = window.GenysisAuth;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  var state = {
    ready: false,
    visible: false,
    range: 7,
    channel: null,
    poll: null,
    loading: false,
    feed: []
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ------------------------------------------------------------ formatting - */

  function num(n) { return Number(n || 0).toLocaleString("en-US"); }

  function dur(seconds) {
    var s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return s + "s";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m " + (s % 60) + "s";
    return Math.floor(m / 60) + "h " + (m % 60) + "m";
  }

  function ago(iso) {
    var s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 5) return "just now";
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }

  function pageName(path) {
    if (!path || path === "/") return "Home";
    return path.replace(/^\//, "").replace(/\.html$/, "")
               .replace(/[-_]/g, " ")
               .replace(/^./, function (c) { return c.toUpperCase(); });
  }

  /* ----------------------------------------------------------------- rpc --- */

  function rpc(fn, args) {
    return Auth.client().rpc(fn, args || {}).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  function fail(err) {
    var box = $("#anError");
    var msg = (err && (err.message || err.hint)) || String(err);
    // The single most likely cause, worth naming rather than showing a code.
    if (/function .*does not exist|schema cache/i.test(msg)) {
      msg = "The analytics functions are not in the database yet. " +
            "Run supabase/migrations/0007_analytics.sql in the Supabase SQL editor.";
    }
    box.innerHTML = "<span><strong>Traffic data unavailable</strong>" + esc(msg) + "</span>";
    box.hidden = false;
  }

  /* -------------------------------------------------------------- renders -- */

  function renderOverview(o) {
    if (!o) return;
    $("#anVisitorsToday").textContent = num(o.visitors_today);
    $("#anNewToday").textContent      = num(o.new_today);
    $("#anVisitorsWeek").textContent  = num(o.visitors_week);
    $("#anViewsToday").textContent    = num(o.views_today);
    $("#anViewsWeek").textContent     = num(o.views_week);
    $("#anAvgToday").textContent      = dur(o.avg_seconds_today);
    $("#anClicksToday").textContent   = num(o.clicks_today);
    $("#anBounce").textContent        = num(o.bounce_rate_week) + "%";

    setLive(o.live_now);
  }

  function setLive(n) {
    n = Number(n || 0);
    $("#anLiveCount").textContent = num(n);
    $("#anLiveBadge").classList.toggle("is-quiet", n === 0);
    var pip = $("#navLivePip");
    if (pip) pip.hidden = n === 0;
  }

  // A plain inline SVG. No chart library for six numbers a day.
  function renderChart(rows) {
    var box = $("#anChart");
    if (!rows || !rows.length) { box.innerHTML = '<p class="muted-note">No traffic yet.</p>'; return; }

    var W = 820, H = 220, padL = 34, padB = 28, padT = 12;
    var peak = Math.max(1, Math.max.apply(null, rows.map(function (r) { return Number(r.views) || 0; })));
    var step = (W - padL) / rows.length;
    var barW = Math.max(4, Math.min(30, step * 0.42));
    var plotH = H - padB - padT;

    function y(v) { return padT + plotH - (Number(v) || 0) / peak * plotH; }

    var bars = rows.map(function (r, i) {
      var x = padL + i * step + (step - barW * 2 - 3) / 2;
      var vh = plotH - (y(r.views) - padT);
      var uh = plotH - (y(r.visitors) - padT);
      var d = new Date(r.day + "T12:00:00");
      var day = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return '<g class="an-bar-g"><title>' + esc(day) + ": " + num(r.views) +
             " views, " + num(r.visitors) + " visitors, " + num(r.clicks) + " clicks</title>" +
             '<rect class="k-views" x="' + x.toFixed(1) + '" y="' + y(r.views).toFixed(1) +
               '" width="' + barW.toFixed(1) + '" height="' + Math.max(0, vh).toFixed(1) + '" rx="2"/>' +
             '<rect class="k-visitors" x="' + (x + barW + 3).toFixed(1) + '" y="' + y(r.visitors).toFixed(1) +
               '" width="' + barW.toFixed(1) + '" height="' + Math.max(0, uh).toFixed(1) + '" rx="2"/>' +
             "</g>";
    }).join("");

    // Only label a few days, or they collide at 90-day ranges.
    var every = Math.ceil(rows.length / 8);
    var labels = rows.map(function (r, i) {
      if (i % every !== 0 && i !== rows.length - 1) return "";
      var d = new Date(r.day + "T12:00:00");
      return '<text class="an-axis" x="' + (padL + i * step + step / 2).toFixed(1) +
             '" y="' + (H - 8) + '" text-anchor="middle">' +
             d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + "</text>";
    }).join("");

    var grid = [0, 0.5, 1].map(function (f) {
      var gy = padT + plotH - f * plotH;
      return '<line class="an-grid" x1="' + padL + '" x2="' + W + '" y1="' + gy.toFixed(1) +
             '" y2="' + gy.toFixed(1) + '"/>' +
             '<text class="an-axis" x="' + (padL - 8) + '" y="' + (gy + 4).toFixed(1) +
             '" text-anchor="end">' + Math.round(peak * f) + "</text>";
    }).join("");

    box.innerHTML = '<svg viewBox="0 0 ' + W + " " + H +
      '" preserveAspectRatio="none" role="img" aria-label="Daily traffic">' +
      grid + bars + labels + "</svg>";
  }

  function renderPages(rows) {
    var body = $("#anPages").querySelector("tbody");
    if (!rows || !rows.length) {
      body.innerHTML = '<tr><td colspan="6" class="muted-note">No page views in this range.</td></tr>';
      return;
    }
    var peak = Math.max.apply(null, rows.map(function (r) { return Number(r.views); }));
    body.innerHTML = rows.map(function (r, i) {
      var pct = peak ? (Number(r.views) / peak) * 100 : 0;
      return "<tr>" +
        '<td><span class="an-rank">' + (i + 1) + "</span>" +
          '<span class="an-page"><b>' + esc(pageName(r.path)) + "</b>" +
          "<small>" + esc(r.path) + "</small></span>" +
          '<span class="an-bar" style="--w:' + pct.toFixed(1) + '%"></span></td>' +
        '<td class="n"><b>' + num(r.views) + "</b><small>" + (r.share || 0) + "%</small></td>" +
        '<td class="n">' + num(r.visitors) + "</td>" +
        '<td class="n">' + dur(r.avg_seconds) + "</td>" +
        '<td class="n">' + (r.avg_scroll || 0) + "%</td>" +
        '<td class="n">' + num(r.clicks) + "</td>" +
      "</tr>";
    }).join("");
  }

  var KIND_LABEL = {
    cta: "Call to action", call: "Phone", email: "Email",
    outbound: "External link", form: "Form", click: "Link"
  };

  function renderClicks(rows) {
    var body = $("#anClicks").querySelector("tbody");
    if (!rows || !rows.length) {
      body.innerHTML = '<tr><td colspan="4" class="muted-note">No clicks in this range.</td></tr>';
      return;
    }
    var peak = Math.max.apply(null, rows.map(function (r) { return Number(r.clicks); }));
    body.innerHTML = rows.map(function (r) {
      var pct = peak ? (Number(r.clicks) / peak) * 100 : 0;
      return "<tr>" +
        '<td><span class="an-page"><b>' + esc(r.label) + "</b>" +
          (r.href ? "<small>" + esc(r.href) + "</small>" : "") + "</span>" +
          '<span class="an-bar" style="--w:' + pct.toFixed(1) + '%"></span></td>' +
        '<td><span class="an-kind k-' + esc(r.kind) + '">' +
          esc(KIND_LABEL[r.kind] || r.kind) + "</span></td>" +
        '<td class="n"><b>' + num(r.clicks) + "</b></td>" +
        '<td class="n">' + num(r.visitors) + "</td>" +
      "</tr>";
    }).join("");
  }

  var SOURCE_LABEL = {
    direct: "Direct / typed in", organic: "Search engine", ai: "AI assistant",
    social: "Social", referral: "Another website", internal: "Within our site"
  };

  function renderSources(rows) {
    var body = $("#anSources").querySelector("tbody");
    if (!rows || !rows.length) {
      body.innerHTML = '<tr><td colspan="3" class="muted-note">No data in this range.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (r) {
      return "<tr>" +
        '<td><span class="an-page"><b>' + esc(SOURCE_LABEL[r.source] || r.source) + "</b>" +
          "<small>" + esc(r.referrer_host) + "</small></span></td>" +
        '<td class="n"><b>' + num(r.views) + "</b></td>" +
        '<td class="n">' + num(r.visitors) + "</td>" +
      "</tr>";
    }).join("");
  }

  function renderDevices(rows) {
    var box = $("#anDevices");
    if (!rows || !rows.length) { box.innerHTML = ""; return; }
    var total = rows.reduce(function (a, r) { return a + Number(r.views); }, 0) || 1;
    box.innerHTML = rows.map(function (r) {
      var pct = Math.round((Number(r.views) / total) * 100);
      return '<div class="an-device"><b>' + esc(r.device) + "</b>" +
             '<span class="an-meter"><i style="width:' + pct + '%"></i></span>' +
             "<span>" + pct + "%</span></div>";
    }).join("");
  }

  function renderNow(rows) {
    var body = $("#anNow").querySelector("tbody");
    if (!rows || !rows.length) {
      body.innerHTML = '<tr><td colspan="3" class="muted-note">Nobody on the site right now.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (r) {
      return "<tr>" +
        '<td><span class="an-page"><b>' + esc(pageName(r.path)) + "</b>" +
          "<small>" + esc(r.path) + "</small></span></td>" +
        '<td class="n"><b>' + num(r.visitors) + "</b></td>" +
        '<td class="n">' + dur(r.seconds) + "</td>" +
      "</tr>";
    }).join("");
  }

  // The feed reads as a sentence, so each kind needs its own verb - "Form
  // contactForm" is not something a person would say.
  var VERB = {
    click: "clicked", cta: "clicked", outbound: "followed",
    call: "tapped", email: "emailed", form: "submitted",
    scroll: "read to the end of", video: "played"
  };

  function renderFeed() {
    var ul = $("#anFeed");
    if (!state.feed.length) {
      ul.innerHTML = '<li class="muted-note">Waiting for activity…</li>';
      return;
    }
    ul.innerHTML = state.feed.slice(0, 40).map(function (r) {
      var isView = r.kind === "view";
      var what = isView
        ? "viewed <b>" + esc(pageName(r.path)) + "</b>"
        : VERB[r.kind] + " <b>" + esc(r.label || r.path) + "</b>" +
          '<span class="an-on"> on ' + esc(pageName(r.path)) + "</span>";
      var tag = isView
        ? (r.is_new ? '<span class="an-kind k-new">New visitor</span>'
                    : '<span class="an-kind k-view">' + esc(r.device) + "</span>")
        : '<span class="an-kind k-' + esc(r.kind) + '">' + esc(KIND_LABEL[r.kind] || r.kind) + "</span>";
      return '<li class="' + (r._fresh ? "is-fresh" : "") + '">' +
             "<span>" + what + "</span>" + tag +
             '<time datetime="' + esc(r.happened_at) + '">' + ago(r.happened_at) + "</time></li>";
    }).join("");
  }

  function pushFeed(row) {
    row._fresh = true;
    state.feed.unshift(row);
    state.feed = state.feed.slice(0, 60);
    renderFeed();
    // Drop the highlight so the next arrival is the one that flashes.
    setTimeout(function () { row._fresh = false; }, 2000);
  }

  /* ------------------------------------------------------------- loading -- */

  function stamp(text) { $("#anStamp").textContent = text; }

  function refresh(quiet) {
    if (state.loading) return Promise.resolve();
    state.loading = true;
    if (!quiet) stamp("updating…");

    var d = state.range;
    return Promise.all([
      rpc("analytics_overview"),
      rpc("analytics_pages",   { p_days: d }),
      rpc("analytics_clicks",  { p_days: d }),
      rpc("analytics_daily",   { p_days: d === 1 ? 14 : d }),
      rpc("analytics_sources", { p_days: d }),
      rpc("analytics_devices", { p_days: d }),
      rpc("analytics_now"),
      rpc("analytics_live",    { p_limit: 40 })
    ]).then(function (r) {
      $("#anError").hidden = true;
      renderOverview(r[0]);
      renderPages(r[1]);
      renderClicks(r[2]);
      renderChart(r[3]);
      renderSources(r[4]);
      renderDevices(r[5]);
      renderNow(r[6]);
      state.feed = r[7] || [];
      renderFeed();
      stamp("live · updated " + new Date().toLocaleTimeString("en-US",
            { hour: "numeric", minute: "2-digit", second: "2-digit" }));
    }).catch(fail).then(function () {
      state.loading = false;
    });
  }

  // Realtime can deliver a burst - one view plus four clicks in a second. Wait
  // for the burst to settle before spending eight round trips re-aggregating.
  var settle = null;
  function refreshSoon() {
    clearTimeout(settle);
    settle = setTimeout(function () { refresh(true); }, 1200);
  }

  /* ------------------------------------------------------------ realtime -- */

  function subscribe() {
    if (state.channel) return;
    var client = Auth.client();

    state.channel = client.channel("genysis-traffic")
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "page_views" },
          function (payload) {
            var v = payload.new || {};
            pushFeed({
              happened_at: v.started_at, kind: "view", path: v.path,
              label: v.title, device: v.device, source: v.source, is_new: v.is_new
            });
            refreshSoon();
          })
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "page_events" },
          function (payload) {
            var e = payload.new || {};
            pushFeed({
              happened_at: e.created_at, kind: e.kind, path: e.path,
              label: e.label, device: "—", source: "—", is_new: false
            });
            refreshSoon();
          })
      .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "page_views" },
          // Pings land as updates. They move "live now" and time-on-page, but
          // they are not activity worth a feed line.
          function () { refreshSoon(); })
      .subscribe(function (status) {
        if (status === "SUBSCRIBED") stamp("live · connected");
        // Anything else and the 20s poll is carrying us; say so honestly
        // rather than showing a green light that means nothing.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          stamp("live updates unavailable · refreshing every 20s");
        }
      });
  }

  function unsubscribe() {
    if (!state.channel) return;
    Auth.client().removeChannel(state.channel);
    state.channel = null;
  }

  /* --------------------------------------------------------------- start -- */

  function start() {
    subscribe();
    refresh(false);
    clearInterval(state.poll);
    // The safety net. Also what keeps "x minutes ago" honest in the feed.
    state.poll = setInterval(function () {
      if (document.visibilityState === "hidden") return;
      renderFeed();
      refresh(true);
    }, 20000);
  }

  function stop() {
    clearInterval(state.poll);
    state.poll = null;
    unsubscribe();
  }

  /* -------------------------------------------------------------- wiring -- */

  $$(".an-range button").forEach(function (b) {
    b.addEventListener("click", function () {
      $$(".an-range button").forEach(function (x) { x.classList.remove("is-on"); });
      b.classList.add("is-on");
      state.range = Number(b.getAttribute("data-range"));
      refresh(false);
    });
  });

  $("#anPurge").addEventListener("click", function () {
    if (!confirm("Delete every page view and click ever recorded?\n\nThis cannot be undone.")) return;
    var btn = this;
    btn.disabled = true;
    btn.textContent = "Clearing…";
    rpc("analytics_purge", { p_days: 0 })
      .then(function () { state.feed = []; return refresh(false); })
      .catch(fail)
      .then(function () {
        btn.disabled = false;
        btn.textContent = "Clear all traffic data";
      });
  });

  document.addEventListener("genysis:admin-ready", function () {
    state.ready = true;
    if (state.visible) start();
  });

  document.addEventListener("genysis:view", function (e) {
    state.visible = e.detail === "analytics";
    if (state.visible && state.ready) start();
    if (!state.visible) stop();
  });

  // A backgrounded tab gets its websocket throttled. Re-sync on return rather
  // than showing numbers that quietly stopped moving an hour ago.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && state.visible && state.ready) refresh(true);
  });
})();
