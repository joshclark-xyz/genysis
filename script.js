/* Genysis IQ — interaction layer
   Progressive enhancement only: every element is usable with JS disabled. */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Opt in to the reveal styles only now that we can also undo them.
  document.documentElement.classList.add("js");

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* --------------------------------------------------- entrance state -- */

  requestAnimationFrame(function () {
    document.body.classList.add("is-ready");
  });

  /* -------------------------------------------------------- header/nav -- */

  var header = $(".site-header");
  var menuBtn = $(".menu-btn");
  var navLinks = $(".nav-links");
  var progress = $(".progress");

  function closeMenu() {
    if (!menuBtn) return;
    menuBtn.setAttribute("aria-expanded", "false");
    navLinks.classList.remove("is-open");
    document.body.classList.remove("is-locked");
  }

  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", function () {
      var open = menuBtn.getAttribute("aria-expanded") === "true";
      menuBtn.setAttribute("aria-expanded", String(!open));
      navLinks.classList.toggle("is-open", !open);
      document.body.classList.toggle("is-locked", !open);
    });

    $$("a", navLinks).forEach(function (a) { a.addEventListener("click", closeMenu); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  /* ------------------------------------------- scroll-driven chrome -- */

  var ticking = false;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;

    if (header) header.classList.toggle("is-stuck", y > 12);

    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
    }

    parallax(y);
    casperRail();
    ticking = false;
  }

  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  }, { passive: true });

  /* --------------------------------------------------------- parallax -- */

  var parallaxEls = $$("[data-parallax]");

  function parallax(y) {
    if (reduced || !parallaxEls.length) return;
    parallaxEls.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
      var speed = parseFloat(el.getAttribute("data-parallax")) || 0.1;
      var offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed;
      el.style.transform = "translate3d(0," + offset.toFixed(2) + "px,0)";
    });
  }

  /* ----------------------------------------------------- scroll reveal -- */

  var revealEls = $$("[data-reveal]");

  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });

    revealEls.forEach(function (el, i) {
      // stagger siblings that share a parent
      if (!el.style.getPropertyValue("--d")) {
        var siblings = Array.prototype.filter.call(el.parentNode.children, function (n) {
          return n.hasAttribute && n.hasAttribute("data-reveal");
        });
        var idx = siblings.indexOf(el);
        if (idx > 0) el.style.setProperty("--d", (idx * 0.09).toFixed(2) + "s");
      }
      io.observe(el);
    });

    // Safety net: nothing stays invisible if the observer never fires.
    setTimeout(function () {
      revealEls.forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
      });
    }, 2500);
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* --------------------------------------------------------- counters -- */

  var counters = $$("[data-count]");

  if (counters.length && "IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        cio.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    if (reduced || isNaN(target)) { el.textContent = el.getAttribute("data-count"); return; }
    var start = performance.now();
    var dur = 1400;
    (function frame(now) {
      var t = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased).toString();
      if (t < 1) requestAnimationFrame(frame);
    })(start);
  }

  /* ------------------------------------------------------ CASPER rail -- */

  var rail = $(".casper-rail");
  var fill = $(".casper-track i");
  var steps = $$(".casper-step");

  function casperRail() {
    if (!rail || !steps.length) return;
    var rect = rail.getBoundingClientRect();
    var span = rect.height + window.innerHeight * 0.5;
    var p = (window.innerHeight * 0.78 - rect.top) / span;
    p = Math.max(0, Math.min(1, p));
    if (fill) fill.style.setProperty("--p", p.toFixed(3));
    steps.forEach(function (step, i) {
      step.classList.toggle("is-active", p >= (i + 0.35) / steps.length);
    });
  }

  /* ------------------------------------------------- card cursor glow -- */

  if (window.matchMedia("(hover: hover)").matches && !reduced) {
    $$(".card").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", (e.clientX - r.left) + "px");
        card.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  /* ------------------------------------------------------ hero video -- */

  var heroVideo = $(".hero-media video");
  if (heroVideo) {
    if (reduced) {
      heroVideo.pause();
      heroVideo.removeAttribute("autoplay");
    } else {
      var play = heroVideo.play();
      if (play && play.catch) play.catch(function () { /* poster carries it */ });
    }
  }

  /* ------------------------------------------------------------- year -- */

  $$("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ------------------------------------------------------ contact form -- */

  var form = $("#contactForm");

  if (form) {
    var status = $(".form-status", form);

    form.addEventListener("input", function (e) {
      var field = e.target.closest(".field");
      if (field) field.classList.remove("is-invalid");
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var ok = true;
      $$("[required]", form).forEach(function (input) {
        var field = input.closest(".field");
        var valid = input.value.trim() !== "" && (input.type !== "email" || /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(input.value));
        field.classList.toggle("is-invalid", !valid);
        if (!valid && ok) { input.focus(); ok = false; }
      });

      if (!ok) return;

      var d = new FormData(form);
      var who = d.get("company") || d.get("name") || "Prospective Client";
      var subject = "Genysis IQ Website Inquiry — " + who;
      var body = [
        "Name: " + (d.get("name") || ""),
        "Company: " + (d.get("company") || ""),
        "Email: " + (d.get("email") || ""),
        "Phone: " + (d.get("phone") || ""),
        "",
        "What they need help with:",
        d.get("message") || ""
      ].join("\n");

      if (status) {
        status.textContent = "Opening your email application with this message ready to send. If nothing happens, email ron@genysisiq.com directly.";
        status.classList.add("is-visible");
      }

      window.location.href = "mailto:ron@genysisiq.com?subject=" +
        encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    });
  }

  // Prime scroll-dependent state on load.
  onScroll();
})();
