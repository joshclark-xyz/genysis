/* =============================================================================
   Genysis IQ - login / signup / password reset page
   ============================================================================= */

(function () {
  "use strict";

  var Auth = window.GenysisAuth;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------- panels -- */

  var panels = {
    signin: $("#panelSignin"),
    signup: $("#panelSignup"),
    forgot: $("#panelForgot")
  };
  var tabs = { signin: $("#tabSignin"), signup: $("#tabSignup") };

  function show(name) {
    Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== name; });
    tabs.signin.setAttribute("aria-selected", String(name === "signin"));
    tabs.signup.setAttribute("aria-selected", String(name === "signup"));
    var first = panels[name].querySelector("input");
    if (first) first.focus({ preventScroll: true });
  }

  tabs.signin.addEventListener("click", function () { show("signin"); });
  tabs.signup.addEventListener("click", function () { show("signup"); });
  $$("[data-go]").forEach(function (b) {
    b.addEventListener("click", function () { show(b.getAttribute("data-go")); });
  });
  $("#forgotLink").addEventListener("click", function (e) {
    e.preventDefault();
    $("#fpEmail").value = $("#siEmail").value;
    show("forgot");
  });

  // ?mode=signup opens straight on the registration tab
  if (/[?&]mode=signup/.test(location.search)) show("signup");

  /* ------------------------------------------------- password visibility -- */

  $$(".pw-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.getAttribute("data-toggle"));
      var showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "Show" : "Hide";
    });
  });

  /* ------------------------------------------------------ password meter -- */

  var meter = $("#pwMeter");
  var note = $("#pwNote");
  var NOTES = [
    "Use at least 8 characters.",
    "Too easy to guess — add length or variety.",
    "Getting there. Try adding a number or symbol.",
    "Good password.",
    "Strong password."
  ];

  function score(pw) {
    if (!pw) return 0;
    var s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^\w\s]/.test(pw)) s++;
    return Math.min(s, 4);
  }

  $("#suPassword").addEventListener("input", function (e) {
    var s = score(e.target.value);
    meter.setAttribute("data-score", String(s));
    note.textContent = NOTES[s];
  });

  /* ---------------------------------------------------------- validation -- */

  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

  function invalidate(input, bad) {
    var field = input.closest(".field");
    if (field) field.classList.toggle("is-invalid", bad);
    return !bad;
  }

  function clearOnInput(form) {
    form.addEventListener("input", function (e) {
      var field = e.target.closest(".field");
      if (field) field.classList.remove("is-invalid");
    });
  }
  [$("#signinForm"), $("#signupForm"), $("#forgotForm")].forEach(clearOnInput);

  /* -------------------------------------------------------------- alerts -- */

  var ICONS = {
    ok: '<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/><path d="m8 12 3 3 5-5"/>',
    err: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'
  };

  function alertIn(el, kind, title, body) {
    el.className = "alert alert--" + (kind === "ok" ? "ok" : kind === "err" ? "err" : "warn");
    el.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      ICONS[kind === "ok" ? "ok" : kind === "err" ? "err" : "info"] + "</svg><span>" +
      (title ? "<strong>" + title + "</strong>" : "") + body + "</span>";
    el.hidden = false;
  }

  function alertOut(el) { el.hidden = true; el.innerHTML = ""; }

  /* ------------------------------------------------------- button states -- */

  function busy(btn, on) {
    btn.disabled = on;
    if (on) {
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + btn.getAttribute("data-label").replace(/^(\w+)/, function (m) {
        return m === "Sign" ? "Signing" : m === "Create" ? "Creating" : m === "Send" ? "Sending" : m;
      }) + "…";
    } else {
      btn.textContent = btn.getAttribute("data-label");
    }
  }

  /* ------------------------------------------------------ not configured -- */

  if (!Auth.isConfigured()) {
    $("#setupNotice").hidden = false;
    $$("form button[type=submit]").forEach(function (b) { b.disabled = true; });
    return;
  }

  /* Already signed in? Go straight through. */
  Auth.getSession().then(function (res) {
    if (res.data && res.data.session) {
      location.replace(nextTarget());
    }
  });

  function nextTarget() {
    var m = /[?&]next=([^&]+)/.exec(location.search);
    var target = m ? decodeURIComponent(m[1]) : "dashboard.html";
    // only ever redirect within this site
    if (/^https?:|^\/\//i.test(target)) return "dashboard.html";
    return target;
  }

  /* -------------------------------------------------------------- signin -- */

  var signinForm = $("#signinForm");
  var signinAlert = $("#signinAlert");
  var lastEmail = "";

  /* Arrived here because the idle timer ran out. */
  if (/[?&]timeout=1/.test(location.search)) {
    alertIn(signinAlert, "warn", "Signed out for your security",
      "You were inactive for a while, so we ended the session. Sign in to pick up where you left off.");
  }

  signinForm.addEventListener("submit", function (e) {
    e.preventDefault();
    alertOut(signinAlert);

    var email = $("#siEmail");
    var pass = $("#siPassword");
    var ok = invalidate(email, !EMAIL.test(email.value.trim()));
    ok = invalidate(pass, pass.value === "") && ok;
    if (!ok) return;

    var btn = signinForm.querySelector("button[type=submit]");
    busy(btn, true);
    lastEmail = email.value.trim();

    Auth.signIn(lastEmail, pass.value)
      .then(function (res) {
        if (res.error) throw res.error;
        location.assign(nextTarget());
      })
      .catch(function (err) {
        busy(btn, false);
        var msg = Auth.humanize(err);
        var unverified = /not been verified|not confirmed/i.test(msg);
        alertIn(signinAlert, "err", "Could not sign in",
          msg + (unverified
            ? ' <button type="button" class="linklike" id="resendLink">Resend the verification email</button>.'
            : ""));
        var resend = $("#resendLink");
        if (resend) resend.addEventListener("click", doResend);
      });
  });

  function doResend() {
    alertIn(signinAlert, "info", "", "Sending a new verification email…");
    Auth.resendVerification(lastEmail)
      .then(function (res) {
        if (res.error) throw res.error;
        alertIn(signinAlert, "ok", "Verification email sent",
          "Check " + lastEmail + " for the new link.");
      })
      .catch(function (err) {
        alertIn(signinAlert, "err", "Could not resend", Auth.humanize(err));
      });
  }

  /* -------------------------------------------------------------- signup -- */

  var signupForm = $("#signupForm");
  var signupAlert = $("#signupAlert");

  signupForm.addEventListener("submit", function (e) {
    e.preventDefault();
    alertOut(signupAlert);

    var company = $("#suCompany"), contact = $("#suContact"), email = $("#suEmail");
    var pass = $("#suPassword"), confirm = $("#suConfirm"), terms = $("#suTerms");

    var ok = invalidate(company, company.value.trim() === "");
    ok = invalidate(contact, contact.value.trim() === "") && ok;
    ok = invalidate(email, !EMAIL.test(email.value.trim())) && ok;
    ok = invalidate(pass, pass.value.length < 8) && ok;
    ok = invalidate(confirm, confirm.value !== pass.value || confirm.value === "") && ok;
    ok = invalidate(terms, !terms.checked) && ok;
    if (!ok) {
      var firstBad = signupForm.querySelector(".field.is-invalid input");
      if (firstBad) firstBad.focus();
      return;
    }

    var btn = signupForm.querySelector("button[type=submit]");
    busy(btn, true);

    Auth.signUp({
      email: email.value.trim(),
      password: pass.value,
      companyName: company.value.trim(),
      contactName: contact.value.trim(),
      phone: $("#suPhone").value.trim()
    })
      .then(function (res) {
        if (res.error) throw res.error;
        busy(btn, false);

        // Supabase returns a user with an empty identities array when the email
        // is already registered (it does not leak that fact via an error).
        var user = res.data && res.data.user;
        if (user && user.identities && user.identities.length === 0) {
          alertIn(signupAlert, "warn", "That email is already registered",
            'Try <button type="button" class="linklike" data-go-signin>signing in</button> instead, ' +
            "or reset your password if you have forgotten it.");
          wireGoSignin();
          return;
        }

        if (res.data && res.data.session) {
          // email confirmation is switched off in this project
          location.assign("dashboard.html");
          return;
        }

        signupForm.reset();
        meter.setAttribute("data-score", "0");
        note.textContent = NOTES[0];
        alertIn(signupAlert, "ok", "Check your email",
          "We have sent a verification link to <strong>" + escapeHtml(email.value.trim()) +
          "</strong>. Click it to activate your account, then sign in. " +
          "The link expires in 24 hours.");
      })
      .catch(function (err) {
        busy(btn, false);
        alertIn(signupAlert, "err", "Could not create the account", Auth.humanize(err));
      });
  });

  function wireGoSignin() {
    var b = signupAlert.querySelector("[data-go-signin]");
    if (b) b.addEventListener("click", function () { show("signin"); });
  }

  /* ------------------------------------------------------ forgot password -- */

  var forgotForm = $("#forgotForm");
  var forgotAlert = $("#forgotAlert");

  forgotForm.addEventListener("submit", function (e) {
    e.preventDefault();
    alertOut(forgotAlert);

    var email = $("#fpEmail");
    if (!invalidate(email, !EMAIL.test(email.value.trim()))) return;

    var btn = forgotForm.querySelector("button[type=submit]");
    busy(btn, true);

    Auth.sendPasswordReset(email.value.trim())
      .then(function (res) {
        if (res.error) throw res.error;
        busy(btn, false);
        alertIn(forgotAlert, "ok", "Check your email",
          "If an account exists for <strong>" + escapeHtml(email.value.trim()) +
          "</strong>, a password reset link is on its way.");
      })
      .catch(function (err) {
        busy(btn, false);
        alertIn(forgotAlert, "err", "Could not send the link", Auth.humanize(err));
      });
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
