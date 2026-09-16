/* =============================================================================
   Genysis IQ — AI Services Direct Sales Division
   Shared behaviour: chrome rendering, navigation, accordion, form, events.

   Header and footer are rendered from content.js so navigation, disclaimers and
   contact details exist in exactly one place across all ten pages.
   ============================================================================= */

(function () {
  "use strict";

  var G = window.GIQ;
  if (!G) return;

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var here = location.pathname.split("/").pop() || "index.html";

  /* ============================================================== analytics ==
     Recruiting funnel events only. No profiling, no third-party pixel: these
     reuse the site's own first-party tracker when it is present, and are inert
     when it is not. */

  function track(label) {
    try {
      var a = document.createElement("a");
      a.setAttribute("data-track", "Opportunity: " + label);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) { /* analytics must never break a page */ }
  }
  window.GIQTrack = track;

  /* ================================================================= header == */

  function renderHeader() {
    var host = $("#giqHeader");
    if (!host) return;

    var links = G.nav.map(function (n) {
      var cur = n.href === here ? ' aria-current="page"' : "";
      // `short` keeps the desktop row on one line; the full label is still the
      // accessible name, so screen readers announce the real destination.
      var label = n.short || n.label;
      var title = n.short ? ' title="' + esc(n.label) + '"' : "";
      return '<a href="' + n.href + '"' + cur + title + ">" + esc(label) + "</a>";
    }).join("");

    host.innerHTML =
      '<div class="founding-bar" role="note">' +
        "<b>" + esc(G.disclaimers.foundingBanner.split("—")[0].trim()) + "</b> " +
        '<span>—</span> ' + esc(G.disclaimers.foundingBanner.split("—")[1].trim()) +
      "</div>" +
      '<header class="site-header">' +
        '<div class="shell nav">' +
          '<a class="brand" href="index.html">' +
            '<img src="../assets/genysis-logo-h-dark.png" alt="Genysis IQ" width="620" height="100">' +
            '<span class="brand-sub">AI Services Network</span>' +
          "</a>" +
          '<button class="menu-btn" id="giqMenu" aria-label="Open menu" aria-expanded="false" aria-controls="giqNav">' +
            "<span></span><span></span><span></span>" +
          "</button>" +
          '<nav class="nav-links" id="giqNav" aria-label="Primary">' + links +
            '<a class="btn btn-primary nav-cta" href="' + G.navCta.href + '">' + esc(G.navCta.label) + "</a>" +
          "</nav>" +
        "</div>" +
      "</header>" +
      '<div class="nav-scrim" id="giqScrim"></div>';

    var btn = $("#giqMenu"), navEl = $("#giqNav"), scrim = $("#giqScrim");

    function setOpen(open) {
      navEl.classList.toggle("is-open", open);
      scrim.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("is-locked", open);
      if (open) { var f = navEl.querySelector("a"); if (f) f.focus(); }
    }
    btn.addEventListener("click", function () {
      setOpen(btn.getAttribute("aria-expanded") !== "true");
    });
    scrim.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navEl.classList.contains("is-open")) { setOpen(false); btn.focus(); }
    });
    // A resize past the breakpoint must not leave the drawer state stuck on.
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1200) setOpen(false);
    });
  }

  /* ================================================================= footer == */

  function renderFooter() {
    var host = $("#giqFooter");
    if (!host) return;

    var cols = G.nav.slice(0, 5).map(function (n) {
      return '<a href="' + n.href + '">' + esc(n.label) + "</a>";
    }).join("");
    var cols2 = G.nav.slice(5).map(function (n) {
      return '<a href="' + n.href + '">' + esc(n.label) + "</a>";
    }).join("") + '<a href="' + G.navCta.href + '">' + esc(G.navCta.label) + "</a>";

    host.innerHTML =
      '<footer class="site-footer">' +
        '<div class="shell">' +
          '<div class="footer-grid">' +
            "<div>" +
              '<img src="../assets/genysis-logo-light.png" alt="Genysis IQ" width="880" height="501" style="width:172px" loading="lazy">' +
              '<p class="footer-tag">' + esc(G.contact.tagline) + "</p>" +
              '<p style="font-size:14px;color:#93aecb;max-width:38ch">' + esc(G.messages.positioning) + "</p>" +
            "</div>" +
            "<div><h3>The opportunity</h3><div class=\"footer-links\">" + cols + "</div></div>" +
            "<div><h3>More</h3><div class=\"footer-links\">" + cols2 +
              '<a href="' + G.contact.mainSite + '">Genysis IQ main site</a>' +
              '<a href="../privacy.html">Privacy</a>' +
              '<a href="../terms.html">Terms</a>' +
              '<a href="mailto:' + G.contact.email + '">' + esc(G.contact.email) + "</a>" +
            "</div></div>" +
          "</div>" +

          '<div class="footer-legal">' +
            "<p><strong style=\"color:#c3d6ea\">Founding-stage notice.</strong> " + esc(G.disclaimers.foundingNotice) + "</p>" +
            "<p><strong style=\"color:#c3d6ea\">Compensation notice.</strong> " + esc(G.disclaimers.compensation) + "</p>" +
            "<p>" + esc(G.disclaimers.footer) + "</p>" +
          "</div>" +

          '<div class="footer-bottom">' +
            "<span>&copy; <span id=\"giqYear\"></span> Genysis IQ. All rights reserved.</span>" +
            "<span>" + esc(G.contact.location) + " &middot; " +
              '<a href="' + G.contact.phoneHref + '">' + esc(G.contact.phone) + "</a></span>" +
          "</div>" +
        "</div>" +
      "</footer>";

    var y = $("#giqYear");
    if (y) y.textContent = new Date().getFullYear();
  }

  /* ============================================================== accordion == */

  function initFaq() {
    $$(".faq-q").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        var panel = document.getElementById(btn.getAttribute("aria-controls"));
        if (panel) panel.hidden = open;
      });
    });
  }

  /* ================================================================== forms == */

  var EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  function initForm() {
    var form = $("#interestForm");
    if (!form) return;

    var started = false;
    form.addEventListener("input", function () {
      if (!started) { started = true; track("Express Interest started"); }
    }, { once: false });

    // Deep link from "Request Founding Leader Information" preselects the reason.
    var m = /[?&]interest=founding/.test(location.search);
    if (m) {
      var sel = $("#interestType");
      if (sel) sel.value = "Founding Leader consideration";
    }

    function bad(field, on) {
      field.classList.toggle("is-bad", on);
      var input = field.querySelector("input, select, textarea");
      if (input) input.setAttribute("aria-invalid", on ? "true" : "false");
      return !on;
    }

    form.addEventListener("submit", function (e) {
      var ok = true;
      var first = null;

      $$("[data-required]", form).forEach(function (field) {
        var input = field.querySelector("input, select, textarea");
        var val = (input.value || "").trim();
        var isBad = !val;
        if (!isBad && input.type === "email") isBad = !EMAIL.test(val);
        if (!bad(field, isBad)) { ok = false; if (!first) first = input; }
      });

      var consentField = $("#consentField");
      var consent = $("#consent");
      if (!consent.checked) {
        consentField.classList.add("is-bad");
        consent.setAttribute("aria-invalid", "true");
        ok = false;
        if (!first) first = consent;
      } else {
        consentField.classList.remove("is-bad");
        consent.setAttribute("aria-invalid", "false");
      }

      if (!ok) {
        e.preventDefault();
        $("#formStatus").textContent = "Please complete the highlighted fields.";
        if (first) first.focus();
        return;
      }

      $("#formStatus").textContent = "Sending…";
      track("Express Interest submitted");
      // Native POST to the configured handler follows.
    });

    // Clear the error as soon as the person fixes it.
    form.addEventListener("input", function (e) {
      var field = e.target.closest("[data-required], #consentField");
      if (field) field.classList.remove("is-bad");
    });
  }

  /* ================================================================= reveal == */

  function initReveal() {
    var els = $$("[data-reveal]");
    if (!els.length) return;
    if (!("IntersectionObserver" in window) ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ============================================================ CTA tracking == */

  function initTracking() {
    var MAP = {
      "representative.html": "Explore Opportunity click",
      "services.html": "View Services click",
      "compensation.html": "Compensation Preview click",
      "founding-leaders.html": "Founding Leader click",
      "ai-advantage.html": "AI Platform click"
    };
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      var target = (a.getAttribute("href") || "").split("?")[0];
      if (MAP[target]) track(MAP[target]);
    }, true);

    // Page-view events for the two pages worth measuring on arrival.
    if (here === "compensation.html")     track("Compensation Preview view");
    if (here === "founding-leaders.html") track("Founding Leader page view");
  }

  /* =================================================================== boot == */

  function boot() {
    renderHeader();
    renderFooter();
    initFaq();
    initForm();
    initReveal();
    initTracking();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();
