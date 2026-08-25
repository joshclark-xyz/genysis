/* =============================================================================
   Genysis IQ - client dashboard
   ============================================================================= */

(function () {
  "use strict";

  var Auth = window.GenysisAuth;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  var state = { user: null, session: null, company: null };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* --------------------------------------------------------- not set up -- */

  if (!Auth.isConfigured()) {
    document.body.innerHTML =
      '<div style="min-height:100vh;display:grid;place-items:center;padding:40px">' +
      '<div class="auth-card"><div class="alert alert--warn">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>' +
      '<span><strong>Supabase is not configured</strong>Add your project URL and anon key to ' +
      "<code>assets/js/supabase-config.js</code>, then reload.</span></div>" +
      '<p class="auth-alt"><a href="index.html" style="color:var(--blue-soft)">Back to the website</a></p></div></div>';
    return;
  }

  /* ------------------------------------------------------ navigation --- */

  var VIEWS = {
    overview:   { title: "Overview",       sub: "Your Genysis IQ account at a glance." },
    assistants: { title: "AI assistants",  sub: "Custom assistants built for your company." },
    chats:      { title: "Conversations",  sub: "Chats your team has had with your assistants." },
    files:      { title: "File depot",     sub: "Files stored for your company on the Genysis IQ servers." },
    account:    { title: "Account",        sub: "Company profile and sign-in details." }
  };

  function setView(name) {
    if (!VIEWS[name]) name = "overview";
    $$("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== name; });
    $$(".side-nav a[data-view]").forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("data-view") === name);
    });
    $("#viewTitle").textContent = VIEWS[name].title;
    $("#viewSub").textContent = VIEWS[name].sub;
    closeSide();
    if (name === "assistants") {
      loadAssistants();
      if (pendingChatId) { openConversation(pendingChatId); pendingChatId = null; }
    }
    if (name === "chats") loadChats();
    if (name === "files") loadFiles();
  }

  window.addEventListener("hashchange", function () {
    setView((location.hash || "#overview").slice(1));
  });

  $$("[data-view-link]").forEach(function (b) {
    b.addEventListener("click", function () {
      location.hash = "#" + b.getAttribute("data-view-link");
    });
  });

  /* ------------------------------------------------------ mobile drawer -- */

  var side = $("#appSide"), scrim = $("#appScrim"), burger = $("#appBurger");

  function closeSide() {
    side.classList.remove("is-open");
    scrim.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  }
  burger.addEventListener("click", function () {
    var open = side.classList.toggle("is-open");
    scrim.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
  });
  scrim.addEventListener("click", closeSide);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSide(); });

  /* --------------------------------------------------------- password UI -- */

  $$(".pw-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.getAttribute("data-toggle"));
      var showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "Show" : "Hide";
    });
  });

  /* ------------------------------------------------------------- alerts -- */

  function alertIn(el, kind, title, body) {
    el.className = "alert alert--" + kind;
    el.innerHTML = (title ? "<strong>" + title + "</strong>" : "") + body;
    el.hidden = false;
  }
  function alertOut(el) { el.hidden = true; el.innerHTML = ""; }

  function busy(btn, on) {
    btn.disabled = on;
    btn.textContent = on ? "Saving…" : btn.getAttribute("data-label");
  }

  /* ------------------------------------------------------------- render -- */

  function unskeleton(el, text, muted) {
    el.classList.remove("skeleton");
    el.textContent = text || "—";
    if (el.tagName === "DD") el.classList.toggle("muted", !text);
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join("") || "?";
  }

  var STATUS = {
    pending:   { label: "Pending setup", cls: "badge--warn", tile: "Pending",
                 note: "Genysis IQ is provisioning your assistants. We will email you when they are ready." },
    active:    { label: "Active",        cls: "badge--ok",   tile: "Active",
                 note: "Your account is live and your assistants are available." },
    suspended: { label: "Suspended",     cls: "badge--err",  tile: "Suspended",
                 note: "This account is on hold. Contact Genysis IQ to reactivate it." }
  };

  function render() {
    var c = state.company || {};
    var u = state.user;
    var s = STATUS[c.status] || STATUS.pending;

    $("#userAvatar").textContent = initials(c.company_name || u.email);
    unskeleton($("#userCompany"), c.company_name || "Your company");
    unskeleton($("#userEmail"), u.email);

    var badge = $("#statusBadge");
    badge.className = "badge " + s.cls;
    badge.textContent = s.label;

    $("#tileStatus").textContent = s.tile;
    $("#tileStatusNote").textContent = s.note;

    var created = c.created_at || u.created_at;
    $("#tileSince").textContent = created
      ? new Date(created).toLocaleDateString(undefined, { month: "short", year: "numeric" })
      : "—";

    unskeleton($("#ovCompany"), c.company_name);
    unskeleton($("#ovContact"), c.contact_name);
    unskeleton($("#ovEmail"), u.email);
    unskeleton($("#ovPhone"), c.phone);
    unskeleton($("#ovIndustry"), c.industry);
    unskeleton($("#ovWebsite"), c.website);

    $("#acCompany").value = c.company_name || "";
    $("#acContact").value = c.contact_name || "";
    $("#acPhone").value = c.phone || "";
    $("#acIndustry").value = c.industry || "";
    $("#acWebsite").value = c.website || "";

    var adminNav = $("#adminNav");
    if (adminNav) adminNav.hidden = !c.is_admin;

    var unverified = !u.email_confirmed_at && !u.confirmed_at;
    $("#verifyBanner").hidden = !unverified;
    if (unverified) $("#verifyEmail").textContent = u.email;
  }

  /* ------------------------------------------------- assistants / chats -- */

  function emptyState(icon, title, body) {
    return '<div class="empty"><span class="empty-icon">' + icon + "</span>" +
      "<h3>" + esc(title) + "</h3><p>" + body + "</p></div>";
  }

  var GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>';
  var CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/></svg>';

  var loaded = { assistants: false, chats: false, files: false };

  /* ==================================================== assistant chat === */

  var chat = {
    conversationId: null,
    messages: [],        // [{role, content}] for the current conversation
    sending: false
  };

  var chatShell, chatUnavail, chatLog, chatThreads, chatInput, chatSend, chatForm;
  var chatThreadCount = 0;
  var currentTitle = "";

  function cacheChatNodes() {
    chatShell   = $("#chatShell");
    chatUnavail = $("#chatUnavailable");
    chatLog     = $("#chatLog");
    chatThreads = $("#chatThreads");
    chatInput   = $("#chatInput");
    chatSend    = $("#chatSend");
    chatForm    = $("#chatForm");
  }

  function chatBlocked(title, body) {
    chatShell.hidden = true;
    chatUnavail.hidden = false;
    $("#chatUnavailableBody").innerHTML = emptyState(GEAR, title, body);
  }

  function loadAssistants() {
    if (loaded.assistants) return;
    loaded.assistants = true;
    cacheChatNodes();

    var c = state.company || {};

    // The endpoint or the company's key is missing.
    if (!window.GenysisChat.isConfigured(c)) {
      chatBlocked("Your assistant is being set up",
        "Genysis IQ is still provisioning the assistant for your company. It will appear " +
        "here as soon as it is connected, and we will email you when that happens.");
      $("#tileAssistants").textContent = "—";
      $("#tileAssistantsNote").textContent = "Not connected yet";
      return;
    }

    // Connected, but no instructions written for this company yet.
    if (!c.system_prompt || !String(c.system_prompt).trim()) {
      chatBlocked("Almost ready",
        "Your assistant is connected but Genysis IQ has not finished writing its instructions. " +
        '<a href="mailto:info@genysisiq.com" style="color:var(--blue-soft)">Get in touch</a> if this seems wrong.');
      $("#tileAssistants").textContent = "—";
      $("#tileAssistantsNote").textContent = "Awaiting configuration";
      return;
    }

    chatUnavail.hidden = true;
    chatShell.hidden = false;
    $("#tileAssistants").textContent = "1";
    $("#tileAssistantsNote").textContent = esc(c.assistant_name || "Genysis Assistant");
    $("#chatModelNote").textContent = c.assistant_name || "Genysis Assistant";

    wireComposer();
    loadThreads().then(function () {
      if (!chat.conversationId) startNewConversation();
    });
  }

  /* ------------------------------------------------------- conversations -- */

  function loadThreads(selectId) {
    return Auth.client()
      .from("conversations")
      .select("id, title, updated_at")
      .eq("company_id", state.user.id)
      .order("updated_at", { ascending: false })
      .limit(50)
      .then(function (res) {
        if (res.error) throw res.error;
        var rows = res.data || [];
        chatThreadCount = rows.length;
        renderThreads(rows);
        if (selectId) openConversation(selectId);
        else if (rows.length && !chat.conversationId) openConversation(rows[0].id);
        return rows;
      })
      .catch(function (err) {
        console.error("Could not load conversations:", err);
        chatThreads.innerHTML = '<p class="chat-empty-note">Could not load your conversations.</p>';
      });
  }

  function renderThreads(rows) {
    // Set this first - the empty case returns early below.
    $("#chatClearAll").hidden = rows.length < 2;

    if (!rows.length) {
      chatThreads.innerHTML = '<p class="chat-empty-note">No conversations yet.</p>';
      return;
    }
    chatThreads.innerHTML = rows.map(function (r) {
      return '<div class="chat-thread-row' +
        (r.id === chat.conversationId ? " is-active" : "") + '">' +
        '<button type="button" class="chat-thread" data-id="' + esc(r.id) + '">' +
          "<b>" + esc(r.title) + "</b><span>" +
          new Date(r.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
        "</span></button>" +
        '<button type="button" class="thread-del" data-del="' + esc(r.id) +
          '" title="Delete conversation" aria-label="Delete ' + esc(r.title) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>' +
        "</button></div>";
    }).join("");

    $$(".chat-thread", chatThreads).forEach(function (b) {
      b.addEventListener("click", function () { openConversation(b.getAttribute("data-id")); });
    });
    $$(".thread-del", chatThreads).forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = b.getAttribute("data-del");
        var row = rows.filter(function (r) { return r.id === id; })[0];
        deleteConversation(id, row && row.title);
      });
    });
  }

  /* --------------------------------------------------------- deleting --- */

  function deleteConversation(id, title) {
    if (!confirm("Delete “" + (title || "this conversation") + "”?\n\nIts messages are removed too. This cannot be undone.")) return;

    Auth.client()
      .from("conversations")
      .delete()
      .eq("id", id)
      .then(function (res) {
        if (res.error) throw res.error;
        loaded.chats = false;                 // Conversations list is stale
        if (chat.conversationId === id) {
          chat.conversationId = null;
          chat.messages = [];
        }
        return loadThreads().then(function (remaining) {
          // Opening nothing leaves an empty pane; start a fresh chat instead.
          if (!chat.conversationId) {
            if (remaining && remaining.length) openConversation(remaining[0].id);
            else startNewConversation();
          }
        });
      })
      .catch(function (err) {
        alert("Could not delete that conversation: " + (err.message || err));
      });
  }

  function deleteAllConversations() {
    var n = chatThreadCount;
    if (!confirm("Delete all " + n + " conversations?\n\nEvery message in them is removed too. This cannot be undone.")) return;
    if (!confirm("This is permanent. Delete all " + n + " conversations?")) return;

    Auth.client()
      .from("conversations")
      .delete()
      .eq("company_id", state.user.id)
      .then(function (res) {
        if (res.error) throw res.error;
        loaded.chats = false;
        chat.conversationId = null;
        chat.messages = [];
        return loadThreads().then(startNewConversation);
      })
      .catch(function (err) {
        alert("Could not delete the conversations: " + (err.message || err));
      });
  }

  function startNewConversation() {
    chat.conversationId = null;
    chat.messages = [];
    currentTitle = "";
    setToolbar(null);
    $$(".chat-thread", chatThreads).forEach(function (b) { b.classList.remove("is-active"); });
    chatLog.innerHTML = "";
    appendMessage("assistant",
      "Hello. I'm " + (state.company.assistant_name || "your Genysis IQ assistant") +
      ", set up for " + (state.company.company_name || "your company") +
      ". What can I help you with?", { intro: true });
    if (chatInput) chatInput.focus();
  }

  function openConversation(id) {
    if (!id) return;
    chat.conversationId = id;
    var meta = $('.chat-thread[data-id="' + id + '"] b', chatThreads);
    currentTitle = meta ? meta.textContent : "";
    setToolbar(currentTitle);
    $$(".chat-thread", chatThreads).forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-id") === id);
    });
    chatLog.innerHTML = '<p class="chat-empty-note">Loading…</p>';

    Auth.client()
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .then(function (res) {
        if (res.error) throw res.error;
        chat.messages = (res.data || []).map(function (m) {
          return { role: m.role, content: m.content };
        });
        chatLog.innerHTML = "";
        chat.messages.forEach(function (m) { appendMessage(m.role, m.content); });
        scrollLog();
      })
      .catch(function (err) {
        chatLog.innerHTML = '<p class="chat-empty-note">Could not load this conversation.</p>';
        console.error(err);
      });
  }

  /* ------------------------------------------------------------ rendering -- */

  function appendMessage(role, text, opts) {
    opts = opts || {};
    var who = role === "user"
      ? (state.company.contact_name || "You")
      : (state.company.assistant_name || "Assistant");
    var mark = role === "user" ? initials(who) : "AI";
    var isAi = role !== "user";

    var el = document.createElement("div");
    el.className = "msg msg-" + (isAi ? "ai" : "user") + (opts.error ? " msg-error" : "");
    el.innerHTML =
      '<span class="msg-avatar" aria-hidden="true">' + esc(mark) + "</span>" +
      '<div class="msg-body"><div class="msg-who">' + esc(who) + "</div>" +
      '<div class="msg-text"></div></div>';

    var body = el.querySelector(".msg-text");
    // Assistant replies are markdown; what a person typed is shown verbatim.
    if (isAi && !opts.error && window.GenysisMarkdown) {
      body.classList.add("md");
      window.GenysisMarkdown.into(body, text, true);
    } else {
      body.textContent = text;
    }

    // Copy the raw markdown, not the rendered text - people paste it onward.
    if (!opts.intro && !opts.error) {
      var tools = document.createElement("div");
      tools.className = "msg-tools";
      tools.innerHTML = '<button type="button" class="msg-copy">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="9" y="9" width="11" height="11" rx="2"/>' +
        '<path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>Copy</button>';
      el.querySelector(".msg-body").appendChild(tools);

      var btn = tools.querySelector(".msg-copy");
      btn.addEventListener("click", function () {
        copyText(el.__raw != null ? el.__raw : text, btn, "Copy");
      });
    }

    el.__raw = text;
    chatLog.appendChild(el);
    scrollLog();
    return el;
  }

  function appendTyping() {
    var el = document.createElement("div");
    el.className = "msg msg-ai";
    el.id = "chatTyping";
    el.innerHTML =
      '<span class="msg-avatar" aria-hidden="true">AI</span>' +
      '<div class="msg-body"><div class="msg-who">' +
      esc(state.company.assistant_name || "Assistant") + "</div>" +
      '<div class="msg-text msg-typing"><span></span><span></span><span></span></div></div>';
    chatLog.appendChild(el);
    scrollLog();
    return el;
  }

  function scrollLog() { chatLog.scrollTop = chatLog.scrollHeight; }

  /** Copies text and flashes confirmation on the button that asked for it. */
  function copyText(text, btn, restore) {
    var done = function () {
      var label = btn.lastChild;
      if (label && label.nodeType === 3) label.textContent = "Copied";
      else btn.textContent = "Copied";
      btn.classList.add("is-copied");
      setTimeout(function () {
        var l = btn.lastChild;
        if (l && l.nodeType === 3) l.textContent = restore;
        else btn.textContent = restore;
        btn.classList.remove("is-copied");
      }, 1600);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  function legacyCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:absolute;left:-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { /* nothing else to try */ }
    document.body.removeChild(ta);
  }

  /** The whole conversation as a plain markdown transcript. */
  function transcript() {
    var who = state.company.contact_name || "You";
    var ai = state.company.assistant_name || "Assistant";
    var lines = ["# " + (currentTitle || "Conversation"), ""];
    chat.messages.forEach(function (m) {
      lines.push("**" + (m.role === "user" ? who : ai) + "**", "", m.content, "");
    });
    return lines.join("\n").trim() + "\n";
  }

  /* True when the reader is at the bottom, so streaming should keep following.
     If they have scrolled up to read something, leave them where they are. */
  function nearBottom() {
    return chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 80;
  }

  /* ------------------------------------------------------------- composer -- */

  function wireComposer() {
    // Grow the textarea with its content, up to the CSS max-height.
    chatInput.addEventListener("input", function () {
      chatInput.style.height = "auto";
      chatInput.style.height = Math.min(chatInput.scrollHeight, 168) + "px";
      chatSend.disabled = chat.sending || chatInput.value.trim() === "";
    });

    chatInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        chatForm.requestSubmit ? chatForm.requestSubmit() : sendMessage();
      }
    });

    chatForm.addEventListener("submit", function (e) {
      e.preventDefault();
      sendMessage();
    });

    $("#chatNew").addEventListener("click", startNewConversation);
    $("#chatClearAll").addEventListener("click", deleteAllConversations);

    $("#copyThread").addEventListener("click", function () {
      if (!chat.messages.length) return;
      copyText(transcript(), this, "Copy transcript");
    });

    $("#deleteThread").addEventListener("click", function () {
      if (chat.conversationId) deleteConversation(chat.conversationId, currentTitle);
    });
  }

  /** The transcript toolbar only makes sense once a conversation exists. */
  function setToolbar(title) {
    var bar = $("#chatToolbar");
    if (!bar) return;
    if (!title) { bar.hidden = true; return; }
    $("#chatToolbarTitle").textContent = title;
    bar.hidden = false;
  }

  function sendMessage() {
    var text = chatInput.value.trim();
    if (!text || chat.sending) return;

    chat.sending = true;
    chatSend.disabled = true;
    chatInput.value = "";
    chatInput.style.height = "auto";

    // Drop the greeting once a real conversation starts.
    var intro = chatLog.querySelector(".msg-ai");
    if (!chat.messages.length && intro) chatLog.innerHTML = "";

    appendMessage("user", text);
    var history = chat.messages.slice();
    chat.messages.push({ role: "user", content: text });

    var typing = appendTyping();

    ensureConversation(text)
      .then(function () {
        return saveMessage("user", text);
      })
      .then(function () {
        var bubble = null;
        var body = null;
        var pending = false;
        var latest = "";      // newest text; the frame reads this, not a capture
        var finished = false; // once true, no queued frame may overwrite the DOM

        // Re-parsing markdown on every token is wasteful, so coalesce to one
        // render per animation frame. Read `latest` when the frame actually
        // fires - capturing the argument would discard every chunk that
        // arrived while a frame was already queued.
        function paint(full) {
          latest = full;
          if (pending) return;
          pending = true;
          requestAnimationFrame(function () {
            pending = false;
            if (!body || finished) return;
            var stuck = nearBottom();
            window.GenysisMarkdown
              ? window.GenysisMarkdown.into(body, latest, false)
              : (body.textContent = latest);
            if (stuck) scrollLog();
          });
        }

        return window.GenysisChat.stream(
          state.company, history, text,
          function (chunk, full) {
            if (!bubble) {
              typing.remove();
              bubble = appendMessage("assistant", "");
              body = bubble.querySelector(".msg-text");
              body.classList.add("md", "is-streaming");
            }
            paint(full);
          }
        ).then(function (reply) {
          if (!bubble) {                       // nothing streamed - show it now
            typing.remove();
            bubble = appendMessage("assistant", reply.content);
          } else {
            finished = true;                 // stop any in-flight frame
            body.classList.remove("is-streaming");
            bubble.__raw = reply.content;      // what the copy button hands over
            // Final pass: highlight code, add copy buttons, wrap tables.
            window.GenysisMarkdown
              ? window.GenysisMarkdown.into(body, reply.content, true)
              : (body.textContent = reply.content);
            scrollLog();
          }
          return reply;
        });
      })
      .then(function (reply) {
        chat.messages.push({ role: "assistant", content: reply.content });
        return saveMessage("assistant", reply.content);
      })
      .then(function () {
        loaded.chats = false;   // Conversations list is stale now
        // Refresh the sidebar only. Passing an id here would re-open the thread
        // and re-fetch its messages, briefly wiping what is already on screen.
        return loadThreads();
      })
      .catch(function (err) {
        if (typing && typing.parentNode) typing.remove();
        appendMessage("assistant", err.message ||
          "Something went wrong reaching the assistant. Please try again.", { error: true });
        // Roll back so a failed turn is not replayed as context.
        if (chat.messages.length && chat.messages[chat.messages.length - 1].role === "user") {
          chat.messages.pop();
        }
      })
      .then(function () {
        chat.sending = false;
        chatSend.disabled = chatInput.value.trim() === "";
        chatInput.focus();
      });
  }

  /** Creates the conversation row on the first message of a new thread. */
  function ensureConversation(firstMessage) {
    if (chat.conversationId) return Promise.resolve(chat.conversationId);
    return Auth.client()
      .from("conversations")
      .insert({
        company_id: state.user.id,
        title: window.GenysisChat.titleFrom(firstMessage)
      })
      .select("id")
      .single()
      .then(function (res) {
        if (res.error) throw res.error;
        chat.conversationId = res.data.id;
        currentTitle = window.GenysisChat.titleFrom(firstMessage);
        setToolbar(currentTitle);
        return chat.conversationId;
      });
  }

  function saveMessage(role, content) {
    if (!chat.conversationId) return Promise.resolve();
    return Auth.client()
      .from("messages")
      .insert({ conversation_id: chat.conversationId, role: role, content: content })
      .then(function (res) {
        // A history write failing should not lose the on-screen reply.
        if (res.error) console.error("Could not save message:", res.error);
      });
  }

  /* ------------------------------------------- conversations (list view) -- */

  /* Set when a conversation is opened from the Conversations list. */
  var pendingChatId = null;

  function loadChats() {
    if (loaded.chats) return;
    loaded.chats = true;
    var body = $("#chatsBody");

    Auth.client()
      .from("conversations")
      .select("id, title, updated_at, messages(count)")
      .eq("company_id", state.user.id)
      .order("updated_at", { ascending: false })
      .then(function (res) {
        if (res.error) throw res.error;
        var list = res.data || [];

        if (!list.length) {
          body.innerHTML = emptyState(CHAT, "No conversations yet",
            "When you start talking to your assistant, every chat is saved here. " +
            '<a href="#assistants" style="color:var(--blue-soft)">Open your assistant</a>.');
          return;
        }

        body.innerHTML = '<dl class="data-list">' + list.map(function (ch) {
          var count = (ch.messages && ch.messages[0] && ch.messages[0].count) || 0;
          return '<div><dt><a href="#assistants" data-open-chat="' + esc(ch.id) +
            '" style="color:var(--text)">' + esc(ch.title) + '</a></dt>' +
            '<dd class="muted">' + count + (count === 1 ? " message" : " messages") + " · " +
            new Date(ch.updated_at).toLocaleString(undefined,
              { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) +
            "</dd></div>";
        }).join("") + "</dl>";

        $$("[data-open-chat]", body).forEach(function (a) {
          a.addEventListener("click", function () {
            pendingChatId = a.getAttribute("data-open-chat");
          });
        });
      })
      .catch(function (err) {
        body.innerHTML = emptyState(CHAT, "Could not load conversations",
          esc(err.message || String(err)));
      });
  }

  /* ==================================================== file depot ====== */

  var Files = window.GenysisFiles;
  var fileCache = [];

  var FILE_ICON = {
    image:  '<path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v13A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5z"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-2 4 4"/>',
    pdf:    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 17v-4h1.5a1.5 1.5 0 0 1 0 3H9"/>',
    sheet:  '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16"/>',
    doc:    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    archive:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v5M10.5 9h3M12 12v2"/>',
    video:  '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2.5v9L17 14z"/>',
    audio:  '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    code:   '<path d="m9 8-5 4 5 4M15 8l5 4-5 4"/>',
    file:   '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'
  };

  function fileIcon(kind) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (FILE_ICON[kind] || FILE_ICON.file) + "</svg>";
  }

  function loadFiles() {
    if (loaded.files) return;
    loaded.files = true;

    if (!Files.isConfigured()) {
      $("#filesShell").hidden = true;
      $("#filesUnavailable").hidden = false;
      $("#filesUnavailableBody").innerHTML = emptyState(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 17.5z"/></svg>',
        "File storage is being set up",
        "Genysis IQ is connecting your company's file space. It will appear here shortly.");
      return;
    }

    $("#filesUnavailable").hidden = true;
    $("#filesShell").hidden = false;
    wireDropzone();
    refreshFiles();
  }

  function refreshFiles() {
    return Files.list(state.session)
      .then(function (list) {
        fileCache = list || [];
        renderFiles();
      })
      .catch(function (err) {
        $("#filesList").innerHTML =
          '<p class="muted-note">Could not load your files: ' + esc(err.message || err) + "</p>";
      });
  }

  function renderFiles() {
    var q = ($("#fileSearch").value || "").trim().toLowerCase();
    var rows = fileCache.filter(function (f) {
      return !q || String(f.name || "").toLowerCase().indexOf(q) !== -1;
    });

    $("#filesCount").textContent = fileCache.length
      ? fileCache.length + (fileCache.length === 1 ? " file" : " files") + " stored for your company."
      : "Stored on the Genysis IQ servers.";

    if (!fileCache.length) {
      $("#filesList").innerHTML = emptyState(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M3 15v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/></svg>',
        "No files yet",
        "Upload anything your team needs to share with Genysis IQ, or keep to hand.");
      return;
    }

    if (!rows.length) {
      $("#filesList").innerHTML = '<p class="muted-note">No files match that search.</p>';
      return;
    }

    $("#filesList").innerHTML = '<div class="file-list">' + rows.map(function (f) {
      var kind = Files.kindOf(f.name, f.type);
      return '<div class="file-row" data-key="' + esc(f.key) + '">' +
        '<span class="file-icon file-' + kind + '">' + fileIcon(kind) + "</span>" +
        '<div class="file-name"><b>' + esc(f.name) + "</b>" +
          "<small>" + esc(Files.humanSize(f.size)) +
          (f.uploaded ? " · " + new Date(f.uploaded).toLocaleDateString(undefined,
            { month: "short", day: "numeric", year: "numeric" }) : "") + "</small></div>" +
        '<div class="file-actions">' +
          '<button class="icon-btn" data-dl="' + esc(f.key) + '" title="Download" aria-label="Download ' + esc(f.name) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/></svg></button>' +
          '<button class="icon-btn icon-danger" data-rm="' + esc(f.key) + '" title="Delete" aria-label="Delete ' + esc(f.name) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button>' +
        "</div></div>";
    }).join("") + "</div>";

    $$("[data-dl]").forEach(function (b) {
      b.addEventListener("click", function () {
        var key = b.getAttribute("data-dl");
        var f = fileCache.filter(function (x) { return x.key === key; })[0];
        b.disabled = true;
        Files.download(state.session, key, f && f.name)
          .catch(function (err) { alert(err.message || err); })
          .then(function () { b.disabled = false; });
      });
    });

    $$("[data-rm]").forEach(function (b) {
      b.addEventListener("click", function () {
        var key = b.getAttribute("data-rm");
        var f = fileCache.filter(function (x) { return x.key === key; })[0];
        if (!confirm("Delete “" + (f ? f.name : "this file") + "”? This cannot be undone.")) return;
        b.disabled = true;
        Files.remove(state.session, key)
          .then(function () {
            fileCache = fileCache.filter(function (x) { return x.key !== key; });
            renderFiles();
          })
          .catch(function (err) { b.disabled = false; alert(err.message || err); });
      });
    });
  }

  /* ------------------------------------------------------------ uploads -- */

  function wireDropzone() {
    var dz = $("#dropzone"), input = $("#fileInput");
    if (dz.dataset.wired) return;
    dz.dataset.wired = "yes";

    $("#fileSearch").addEventListener("input", renderFiles);

    dz.addEventListener("click", function () { input.click(); });
    dz.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
    });
    input.addEventListener("change", function () {
      queueUploads([].slice.call(input.files));
      input.value = "";
    });

    ["dragenter", "dragover"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        dz.classList.add("is-over");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        if (ev === "dragleave" && dz.contains(e.relatedTarget)) return;
        dz.classList.remove("is-over");
      });
    });
    dz.addEventListener("drop", function (e) {
      queueUploads([].slice.call(e.dataTransfer.files));
    });

    // Dropping anywhere else should not make the browser navigate away.
    ["dragover", "drop"].forEach(function (ev) {
      window.addEventListener(ev, function (e) {
        if (!dz.contains(e.target)) e.preventDefault();
      });
    });
  }

  function queueUploads(list) {
    if (!list.length) return;
    var queue = $("#uploadQueue");
    queue.hidden = false;

    list.forEach(function (file) {
      var row = document.createElement("div");
      row.className = "upload-row";
      row.innerHTML =
        '<div class="upload-info"><b>' + esc(file.name) + "</b>" +
        "<small>" + esc(Files.humanSize(file.size)) + "</small></div>" +
        '<div class="upload-bar"><i></i></div>' +
        '<span class="upload-pct">0%</span>';
      queue.appendChild(row);

      var bar = row.querySelector(".upload-bar i");
      var pct = row.querySelector(".upload-pct");

      Files.upload(state.session, file, function (p) {
        bar.style.width = p + "%";
        pct.textContent = p + "%";
      })
        .then(function (saved) {
          row.classList.add("is-done");
          pct.textContent = "Done";
          if (saved && saved.key) fileCache.unshift(saved);
          renderFiles();
          setTimeout(function () {
            row.remove();
            if (!queue.children.length) queue.hidden = true;
          }, 2200);
          // Trust the server's view over our optimistic insert.
          return refreshFiles();
        })
        .catch(function (err) {
          row.classList.add("is-failed");
          pct.textContent = "Failed";
          row.querySelector(".upload-info").innerHTML +=
            '<small class="upload-err">' + esc(err.message || err) + "</small>";
        });
    });
  }

  /* -------------------------------------------------------------- forms -- */

  $$("#profileForm, #passwordForm").forEach(function (form) {
    form.addEventListener("input", function (e) {
      var f = e.target.closest(".field");
      if (f) f.classList.remove("is-invalid");
    });
  });

  $("#profileForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var alertEl = $("#profileAlert");
    alertOut(alertEl);

    var company = $("#acCompany");
    if (company.value.trim() === "") {
      company.closest(".field").classList.add("is-invalid");
      company.focus();
      return;
    }

    var btn = this.querySelector("button[type=submit]");
    busy(btn, true);

    Auth.updateCompany(state.user.id, {
      company_name: company.value.trim(),
      contact_name: $("#acContact").value.trim() || null,
      phone: $("#acPhone").value.trim() || null,
      industry: $("#acIndustry").value.trim() || null,
      website: $("#acWebsite").value.trim() || null
    })
      .then(function (res) {
        if (res.error) throw res.error;
        busy(btn, false);
        state.company = res.data || state.company;
        render();
        alertIn(alertEl, "ok", "Saved. ", "Your company details are up to date.");
      })
      .catch(function (err) {
        busy(btn, false);
        alertIn(alertEl, "err", "Could not save. ", esc(Auth.humanize(err)));
      });
  });

  $("#passwordForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var alertEl = $("#passwordAlert");
    alertOut(alertEl);

    var pw = $("#acPassword"), pw2 = $("#acPassword2");
    var ok = true;
    if (pw.value.length < 8) { pw.closest(".field").classList.add("is-invalid"); ok = false; }
    if (pw2.value !== pw.value || !pw2.value) { pw2.closest(".field").classList.add("is-invalid"); ok = false; }
    if (!ok) return;

    var btn = this.querySelector("button[type=submit]");
    busy(btn, true);

    Auth.updatePassword(pw.value)
      .then(function (res) {
        if (res.error) throw res.error;
        busy(btn, false);
        pw.value = ""; pw2.value = "";
        alertIn(alertEl, "ok", "Password updated. ", "Use it the next time you sign in.");
      })
      .catch(function (err) {
        busy(btn, false);
        alertIn(alertEl, "err", "Could not update. ", esc(Auth.humanize(err)));
      });
  });

  /* ==================================================== session security = */

  function wireSecurity() {
    var Session = window.GenysisSession;
    if (!Session) return;

    var toggle = $("#setEndOnClose");
    if (toggle) {
      toggle.checked = Session.endOnClose();
      toggle.addEventListener("change", function () {
        Session.setEndOnClose(toggle.checked);
      });
    }

    var mins = $("#idleMins");
    if (mins) mins.textContent = Session.idleMinutes;

    // Signed out on idle: land on the login page with an explanation, and
    // come back to whatever they were looking at.
    Session.startIdleWatch(function () {
      var here = location.pathname.split("/").pop() + location.hash;
      Auth.signOut().then(function () {
        location.replace("login.html?timeout=1&next=" + encodeURIComponent(here));
      });
    });
  }

  /* ------------------------------------------------------------ sign out -- */

  function signOut() {
    if (window.GenysisSession) window.GenysisSession.stopIdleWatch();
    Auth.signOut().then(function () { location.replace("login.html"); });
  }
  $("#signOutBtn").addEventListener("click", signOut);
  $("#signOutAll").addEventListener("click", signOut);

  $("#verifyResend").addEventListener("click", function () {
    var btn = this;
    btn.disabled = true;
    btn.textContent = "Sending…";
    Auth.resendVerification(state.user.email)
      .then(function (res) {
        if (res.error) throw res.error;
        btn.textContent = "Sent — check your inbox";
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = "Could not send: " + Auth.humanize(err);
      });
  });

  /* --------------------------------------------------------------- boot -- */

  Auth.guard().then(function (res) {
    if (!res.user) return;              // guard() already redirected
    state.user = res.user;
    state.session = res.session;

    return Auth.getCompany(res.user.id).then(function (r) {
      if (r.error) throw r.error;

      if (!r.data) {
        // The signup trigger did not run for this account — create the row now
        // from whatever metadata we have.
        var meta = res.user.user_metadata || {};
        return Auth.createCompany(res.user.id, {
          company_name: meta.company_name || "Unnamed company",
          contact_name: meta.contact_name || null,
          email: res.user.email,
          phone: meta.phone || null
        }).then(function (created) {
          state.company = created.data || null;
        });
      }
      state.company = r.data;
    });
  })
    .then(function () {
      if (!state.user) return;
      render();
      wireSecurity();
      setView((location.hash || "#overview").slice(1));
    })
    .catch(function (err) {
      if (!state.user) return;
      render();
      setView((location.hash || "#overview").slice(1));
      console.error("Dashboard load error:", err);
    });

  // Sign-out in another tab should not leave this one showing private data.
  Auth.onAuthChange(function (event) {
    if (event === "SIGNED_OUT") location.replace("login.html");
  });
})();
