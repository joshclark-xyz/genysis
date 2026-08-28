/* =============================================================================
   Genysis IQ - public site assistant
   -----------------------------------------------------------------------------
   A small chat widget for the marketing pages. It answers questions about what
   Genysis IQ does and points people at the phone number or the contact form.

   SECURITY NOTE
   The API key below is served to every visitor, because a static page has
   nowhere to hide it. That is acceptable for a throwaway/test key. Before this
   carries a billable key, put a Cloudflare Worker in front of the AI endpoint
   (the file depot Worker is a working example) and point SITE_CHAT.endpoint at
   it, so the key stays server-side. See DASHBOARD-SETUP.md.
   ============================================================================= */

(function () {
  "use strict";

  var CFG = {
    base: "https://api.wsgpolar.me",
    key: "api_test123",
    model: "openai/gpt-oss-120b",
    maxTokens: 700,
    phone: "689.388.7353",
    phoneHref: "tel:+16893887353",
    email: "info@genysisiq.com"
  };

  var SYSTEM_PROMPT = [
    "You are the assistant on the Genysis IQ website. Genysis IQ is a business",
    "consultancy in Orlando, Florida, serving clients across the United States.",
    "Its tagline is \"Where Intelligent Business Scaling Begins\"",
    "",
    "WHO RUNS IT",
    "- Ron Clark, Founder and CEO. 39 years in business, four companies built,",
    "  two with international operations. Created the CASPER framework. An",
    "  award-winning author on AI with executive education from MIT, Wharton and",
    "  the London School of Economics.",
    "- Josh Clark, AI and Technology Director. Handles the technology and AI side.",
    "",
    "WHAT THEY DO",
    "1. Business scaling and architecture - finding the real growth bottleneck,",
    "   reducing owner dependency, role clarity, decision rights, operating rhythm.",
    "2. Systems, processes and SOPs - turning knowledge held in people's heads",
    "   into repeatable, documented workflows, KPIs and scorecards.",
    "3. Sales and customer growth - sales process design, staff training, lead",
    "   handling, customer journey, referral and retention.",
    "4. Practical AI strategy - AI opportunity assessment, conversational AI,",
    "   workflow automation, penetration testing and security assessment, vendor",
    "   evaluation and implementation.",
    "5. Digital presence and discoverability - website conversion, SEO, local and",
    "   AI search, content architecture, Google Business Profile.",
    "",
    "THE CASPER FRAMEWORK",
    "Clarity, Architecture, Systems, Processes, Evaluation, Replication. Six",
    "stages taking a company from understanding its constraint to repeatable",
    "execution that does not depend on the owner.",
    "",
    "HOW TO ANSWER",
    "- Be brief and concrete. Two or three sentences is usually plenty.",
    "- You are a first point of contact, not the consultant. Do not invent",
    "  prices, timelines, guarantees or case studies. Genysis IQ has not",
    "  published pricing - if asked, say it depends on scope and point them to a",
    "  conversation.",
    "- When someone is ready to talk, give them the phone number " + CFG.phone +
      " (answered 24 hours a day, and it can book appointments) or the contact page.",
    "- If a question is outside what Genysis IQ does, say so plainly and offer",
    "  the phone number rather than guessing.",
    "- Never claim to be human. You are the Genysis IQ website assistant."
  ].join("\n");

  var GREETING =
    "Hi — I'm the Genysis IQ assistant. Ask me about scaling, systems, " +
    "practical AI, or how we work. If you'd rather talk to someone, our line is " +
    "answered any time on " + CFG.phone + ".";

  var SUGGESTIONS = [
    "What does Genysis IQ actually do?",
    "What is the CASPER framework?",
    "How do you use AI in a business?",
    "How do I get started?"
  ];

  /* ------------------------------------------------------------- helpers -- */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Light markdown: bold, italic, inline code, links, line breaks. Everything
     is escaped first, so no model output can inject markup. */
  function light(text) {
    var out = esc(text);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|\s)\*([^*\n]+)\*/g, "$1<em>$2</em>");
    // Phone numbers and the email become tappable.
    out = out.replace(/689\.388\.7353/g,
      '<a href="' + CFG.phoneHref + '">689.388.7353</a>');
    out = out.replace(/info@genysisiq\.com/g,
      '<a href="mailto:info@genysisiq.com">info@genysisiq.com</a>');
    out = out.replace(/\n/g, "<br>");
    return out;
  }

  var history = [];      // [{role, content}]
  var sending = false;
  var built = false;
  var els = {};

  /* --------------------------------------------------------------- build -- */

  function build() {
    if (built) return;
    built = true;

    var root = document.createElement("div");
    root.className = "sitechat";
    root.innerHTML =
      '<button class="sitechat-fab" type="button" aria-expanded="false" aria-label="Ask the Genysis IQ assistant">' +
        '<svg class="fab-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/></svg>' +
        '<svg class="fab-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '<span class="fab-label">Ask us anything</span>' +
      "</button>" +
      '<section class="sitechat-panel" role="dialog" aria-label="Genysis IQ assistant" hidden>' +
        '<header class="sitechat-head">' +
          '<span class="sitechat-avatar" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.5 1.5M16.2 16.2l1.5 1.5M17.7 6.3l-1.5 1.5M7.8 16.2l-1.5 1.5"/></svg>' +
          "</span>" +
          "<div><b>Genysis IQ assistant</b><span>Answers instantly &middot; not a human</span></div>" +
          '<button class="sitechat-min" type="button" aria-label="Close">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>' +
          "</button>" +
        "</header>" +
        '<div class="sitechat-log" id="sitechatLog" aria-live="polite"></div>' +
        '<div class="sitechat-suggest" id="sitechatSuggest"></div>' +
        '<form class="sitechat-form">' +
          '<label class="sr-only" for="sitechatInput">Your question</label>' +
          '<textarea id="sitechatInput" rows="1" placeholder="Ask a question…" maxlength="600"></textarea>' +
          '<button type="submit" aria-label="Send" disabled>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
          "</button>" +
        "</form>" +
        '<p class="sitechat-foot">Prefer a person? <a href="' + CFG.phoneHref + '">' +
          CFG.phone + "</a> &middot; answered 24/7</p>" +
      "</section>";

    document.body.appendChild(root);

    els.root = root;
    els.fab = root.querySelector(".sitechat-fab");
    els.panel = root.querySelector(".sitechat-panel");
    els.log = root.querySelector(".sitechat-log");
    els.suggest = root.querySelector("#sitechatSuggest");
    els.form = root.querySelector(".sitechat-form");
    els.input = root.querySelector("#sitechatInput");
    els.send = els.form.querySelector("button");

    els.fab.addEventListener("click", toggle);
    root.querySelector(".sitechat-min").addEventListener("click", close);

    els.input.addEventListener("input", function () {
      els.input.style.height = "auto";
      els.input.style.height = Math.min(els.input.scrollHeight, 110) + "px";
      els.send.disabled = sending || !els.input.value.trim();
    });
    els.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    els.form.addEventListener("submit", function (e) { e.preventDefault(); submit(); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !els.panel.hidden) close();
    });

    say("assistant", GREETING);
    renderSuggestions();
  }

  function renderSuggestions() {
    if (history.length) { els.suggest.innerHTML = ""; return; }
    els.suggest.innerHTML = SUGGESTIONS.map(function (q) {
      return '<button type="button">' + esc(q) + "</button>";
    }).join("");
    [].slice.call(els.suggest.querySelectorAll("button")).forEach(function (b) {
      b.addEventListener("click", function () {
        els.input.value = b.textContent;
        submit();
      });
    });
  }

  /* ---------------------------------------------------------------- open -- */

  function toggle() { els.panel.hidden ? open() : close(); }

  function open() {
    els.panel.hidden = false;
    els.root.classList.add("is-open");
    els.fab.setAttribute("aria-expanded", "true");
    setTimeout(function () { els.input.focus(); }, 120);
    scroll();
  }

  function close() {
    els.panel.hidden = true;
    els.root.classList.remove("is-open");
    els.fab.setAttribute("aria-expanded", "false");
  }

  /* ------------------------------------------------------------ messages -- */

  function say(role, text, opts) {
    opts = opts || {};
    var el = document.createElement("div");
    el.className = "sc-msg sc-" + (role === "user" ? "user" : "ai") +
      (opts.error ? " sc-error" : "");
    el.innerHTML = '<div class="sc-bubble">' +
      (role === "user" ? esc(text) : light(text)) + "</div>";
    els.log.appendChild(el);
    scroll();
    return el;
  }

  function scroll() { els.log.scrollTop = els.log.scrollHeight; }

  function submit() {
    var text = (els.input.value || "").trim();
    if (!text || sending) return;

    sending = true;
    els.send.disabled = true;
    els.input.value = "";
    els.input.style.height = "auto";
    els.suggest.innerHTML = "";

    say("user", text);

    var typing = document.createElement("div");
    typing.className = "sc-msg sc-ai";
    typing.innerHTML = '<div class="sc-bubble sc-typing"><span></span><span></span><span></span></div>';
    els.log.appendChild(typing);
    scroll();

    ask(text)
      .then(function (reply) {
        typing.remove();
        say("assistant", reply);
        history.push({ role: "user", content: text });
        history.push({ role: "assistant", content: reply });
        if (history.length > 16) history = history.slice(-16);
      })
      .catch(function (err) {
        typing.remove();
        say("assistant", err.message ||
          ("Sorry — I could not answer just then. Please call " + CFG.phone +
           " or use the contact form."), { error: true });
      })
      .then(function () {
        sending = false;
        els.send.disabled = !els.input.value.trim();
        els.input.focus();
      });
  }

  /* ------------------------------------------------------------- the API -- */

  function parseRetry(body) {
    var ms = /try again in\s+([\d.]+)\s*ms/i.exec(String(body || ""));
    if (ms) return Math.ceil(parseFloat(ms[1]));
    var s = /try again in\s+([\d.]+)\s*s/i.exec(String(body || ""));
    return s ? Math.ceil(parseFloat(s[1]) * 1000) : null;
  }

  function ask(message, attempt) {
    attempt = attempt || 0;

    var messages = [{ role: "system", content: SYSTEM_PROMPT }]
      .concat(history.slice(-8))
      .concat([{ role: "user", content: message }]);

    return fetch(CFG.base + "/v1/ai/chat?API=" + encodeURIComponent(CFG.key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CFG.model,
        messages: messages,
        max_tokens: CFG.maxTokens,
        temperature: 0.6,
        reasoning_effort: "low"
      })
    }).then(function (res) {
      return res.text().then(function (body) {
        if (!res.ok) {
          // The token budget is shared, so a busy moment can bounce one request.
          if ((res.status === 429 || res.status >= 500) && attempt < 2) {
            var delay = (parseRetry(body) || 900 * Math.pow(2, attempt)) + Math.random() * 300;
            return new Promise(function (r) { setTimeout(r, delay); })
              .then(function () { return ask(message, attempt + 1); });
          }
          throw new Error(
            "We're getting a lot of questions right now. Please try again in a moment, " +
            "or call " + CFG.phone + " — the line is answered 24/7."
          );
        }
        var data = JSON.parse(body);
        var content = data.choices && data.choices[0] &&
          data.choices[0].message && data.choices[0].message.content;
        if (!content || !String(content).trim()) {
          throw new Error("Sorry, I did not catch that. Could you rephrase?");
        }
        return String(content).trim();
      });
    });
  }

  /* ---------------------------------------------------------------- boot -- */

  function init() {
    build();
    // Nudge first-time visitors once they have had a moment to read the page.
    if (!sessionStorage.getItem("genysis.chatSeen")) {
      setTimeout(function () {
        if (built && els.panel.hidden) els.root.classList.add("has-nudge");
      }, 9000);
    }
    els.fab.addEventListener("click", function () {
      els.root.classList.remove("has-nudge");
      try { sessionStorage.setItem("genysis.chatSeen", "1"); } catch (e) {}
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
