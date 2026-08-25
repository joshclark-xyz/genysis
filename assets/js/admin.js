/* =============================================================================
   Genysis IQ - staff admin console
   Approve companies and build the GPT that each one talks to.
   ============================================================================= */

(function () {
  "use strict";

  var Auth = window.GenysisAuth;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  var state = { user: null, session: null, companies: [], editing: null };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function initials(name) {
    var p = String(name || "").trim().split(/\s+/).slice(0, 2);
    return p.map(function (x) { return x.charAt(0).toUpperCase(); }).join("") || "?";
  }

  if (!Auth.isConfigured()) {
    document.body.innerHTML =
      '<div style="min-height:100vh;display:grid;place-items:center;padding:40px">' +
      '<div class="auth-card"><div class="alert alert--warn"><span>' +
      "<strong>Supabase is not configured</strong>Add your project URL and anon key to " +
      "<code>assets/js/supabase-config.js</code>.</span></div></div></div>";
    return;
  }

  /* ------------------------------------------------------- shell plumbing -- */

  var side = $("#appSide"), scrim = $("#appScrim"), burger = $("#appBurger");
  burger.addEventListener("click", function () {
    var open = side.classList.toggle("is-open");
    scrim.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
  });
  scrim.addEventListener("click", function () {
    side.classList.remove("is-open");
    scrim.classList.remove("is-open");
  });

  $("#signOutBtn").addEventListener("click", function () {
    Auth.signOut().then(function () { location.replace("login.html"); });
  });

  /* --------------------------------------------------------------- alerts -- */

  function say(el, kind, title, body) {
    el.className = "alert alert--" + kind;
    el.innerHTML = "<span>" + (title ? "<strong>" + title + "</strong>" : "") + body + "</span>";
    el.hidden = false;
  }

  /* ----------------------------------------------------------- load list -- */

  var STATUS_BADGE = {
    pending: '<span class="badge badge--warn">Pending</span>',
    active: '<span class="badge badge--ok">Active</span>',
    suspended: '<span class="badge badge--err">Suspended</span>'
  };

  function loadCompanies() {
    return Auth.client()
      .from("admin_companies")
      .select("*")
      .order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) throw res.error;
        state.companies = res.data || [];
        renderStats();
        renderList();
      })
      .catch(function (err) {
        $("#adminList").innerHTML =
          '<p class="muted-note">Could not load companies: ' + esc(err.message || err) + "</p>";
      });
  }

  function renderStats() {
    var pending = 0, active = 0, messages = 0;
    state.companies.forEach(function (c) {
      if (c.is_admin) return;                 // staff rows are not clients
      if (c.status === "pending") pending++;
      if (c.status === "active") active++;
      messages += Number(c.message_count || 0);
    });
    $("#statPending").textContent = pending;
    $("#statActive").textContent = active;
    $("#statMessages").textContent = messages;
  }

  function renderList() {
    var q = ($("#adminSearch").value || "").trim().toLowerCase();
    var rows = state.companies.filter(function (c) {
      if (!q) return true;
      return (c.company_name || "").toLowerCase().indexOf(q) !== -1 ||
             (c.email || "").toLowerCase().indexOf(q) !== -1;
    });

    if (!rows.length) {
      $("#adminList").innerHTML = '<p class="muted-note">No companies match.</p>';
      return;
    }

    $("#adminList").innerHTML = rows.map(function (c) {
      var hasPrompt = c.system_prompt && String(c.system_prompt).trim();
      return '<div class="admin-row">' +
        '<div class="admin-co"><b>' + esc(c.company_name) +
          (c.is_admin ? ' <span class="badge" style="margin-left:6px">Staff</span>' : "") +
          "</b><small>" + esc(c.email || "") + "</small></div>" +
        '<div class="admin-meta">' + esc(c.assistant_name || "No assistant") +
          "<small>" + (hasPrompt ? "Prompt set" : "No prompt yet") + "</small></div>" +
        '<div class="admin-meta">' + (STATUS_BADGE[c.status] || c.status) +
          "<small>" + Number(c.message_count || 0) + " messages</small></div>" +
        '<div class="admin-actions">' +
          (c.status === "pending"
            ? '<button class="btn-approve" data-approve="' + esc(c.id) + '">Approve</button>'
            : "") +
          '<button class="btn btn-ghost btn-sm" data-edit="' + esc(c.id) + '">Edit</button>' +
        "</div></div>";
    }).join("");

    $$("[data-approve]").forEach(function (b) {
      b.addEventListener("click", function () { approve(b.getAttribute("data-approve"), b); });
    });
    $$("[data-edit]").forEach(function (b) {
      b.addEventListener("click", function () { openDrawer(b.getAttribute("data-edit")); });
    });
  }

  $("#adminSearch").addEventListener("input", renderList);

  /* -------------------------------------------------------------- approve -- */

  function approve(id, btn) {
    var company = find(id);
    btn.disabled = true;
    btn.textContent = "Approving…";

    Auth.client()
      .from("companies")
      .update({ status: "active" })
      .eq("id", id)
      .select()
      .single()
      .then(function (res) {
        if (res.error) throw res.error;
        company.status = "active";
        renderStats();
        renderList();
        // Nudge staff to finish the job if the assistant has no instructions.
        if (!company.system_prompt || !String(company.system_prompt).trim()) {
          openDrawer(id);
          say($("#drawerAlert"), "warn", "Approved. ",
            "This company still has no system prompt, so the assistant will not start yet. " +
            "Write one below and save.");
        }
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = "Approve";
        alert("Could not approve: " + (err.message || err));
      });
  }

  function find(id) {
    return state.companies.filter(function (c) { return c.id === id; })[0];
  }

  /* --------------------------------------------------------------- drawer -- */

  var drawer = $("#drawer"), drawerScrim = $("#drawerScrim");

  function openDrawer(id) {
    var c = find(id);
    if (!c) return;
    state.editing = c;

    $("#drawerTitle").textContent = c.company_name;
    $("#drawerEmail").textContent = c.email || "";
    $("#fStatus").value = c.status || "pending";
    $("#fAssistant").value = c.assistant_name || "";
    $("#fModel").value = c.ai_model || "openai/gpt-oss-120b";
    $("#fPrompt").value = c.system_prompt || "";
    $("#fApiKey").value = c.ai_api_key || "";
    $("#fCustomerId").value = c.api_customer_id || "";
    $("#drawerAlert").hidden = true;
    $("#testResult").hidden = true;
    $("#testResult").innerHTML = "";

    drawer.hidden = false;
    drawerScrim.hidden = false;
    document.body.classList.add("is-locked");
    $("#fStatus").focus();
  }

  function closeDrawer() {
    drawer.hidden = true;
    drawerScrim.hidden = true;
    document.body.classList.remove("is-locked");
    state.editing = null;
  }

  $("#drawerClose").addEventListener("click", closeDrawer);
  drawerScrim.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !drawer.hidden) closeDrawer();
  });

  /* Starter prompt so staff are not staring at an empty box. */
  $("#promptTemplate").addEventListener("click", function () {
    var c = state.editing || {};
    var name = c.company_name || "the company";
    $("#fPrompt").value =
      "You are the assistant for " + name + ", built by Genysis IQ.\n\n" +
      "ABOUT THE BUSINESS\n" +
      "- Industry: " + (c.industry || "[industry]") + "\n" +
      "- What they do: [one or two lines]\n" +
      "- Who they serve: [their customers]\n\n" +
      "WHAT YOU HELP WITH\n" +
      "- [task one]\n- [task two]\n- [task three]\n\n" +
      "HOW TO ANSWER\n" +
      "- Be direct and practical. No filler.\n" +
      "- Use the company's own terminology.\n" +
      "- If you do not know something specific to this business, say so and " +
      "suggest who internally would know.\n" +
      "- Never invent figures, policies, or commitments.";
    $("#fPrompt").focus();
  });

  /* ----------------------------------------------------------------- save -- */

  $("#companyForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!state.editing) return;

    var btn = this.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Saving…";

    var patch = {
      status: $("#fStatus").value,
      assistant_name: $("#fAssistant").value.trim() || "Genysis Assistant",
      ai_model: $("#fModel").value,
      system_prompt: $("#fPrompt").value.trim() || null,
      ai_api_key: $("#fApiKey").value.trim() || null,
      api_customer_id: $("#fCustomerId").value.trim() || null
    };

    Auth.client()
      .from("companies")
      .update(patch)
      .eq("id", state.editing.id)
      .select()
      .single()
      .then(function (res) {
        if (res.error) throw res.error;
        Object.keys(patch).forEach(function (k) { state.editing[k] = patch[k]; });
        renderStats();
        renderList();
        btn.disabled = false;
        btn.textContent = btn.getAttribute("data-label");
        say($("#drawerAlert"), "ok", "Saved. ",
          patch.status === "active" && patch.system_prompt
            ? "This company's assistant is live."
            : "Changes stored.");
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = btn.getAttribute("data-label");
        say($("#drawerAlert"), "err", "Could not save. ", esc(err.message || err));
      });
  });

  /* ------------------------------------------------- try the prompt live -- */

  $("#testPrompt").addEventListener("click", function () {
    var btn = this;
    var out = $("#testResult");
    var prompt = $("#fPrompt").value.trim();

    if (!prompt) {
      out.hidden = false;
      out.innerHTML = '<div class="test-out"><b>Nothing to test</b>Write a system prompt first.</div>';
      return;
    }

    btn.disabled = true;
    btn.textContent = "Testing…";
    out.hidden = false;
    out.innerHTML = '<div class="test-out"><b>Testing</b>Asking the assistant to introduce itself…</div>';

    // Test against the values in the form, not what is saved.
    var draft = {
      system_prompt: prompt,
      ai_model: $("#fModel").value,
      ai_api_key: $("#fApiKey").value.trim() || null
    };

    window.GenysisChat.send(draft, [], "Briefly introduce yourself and what you can help with.")
      .then(function (reply) {
        out.innerHTML = '<div class="test-out"><b>' +
          esc($("#fAssistant").value.trim() || "Assistant") + " replied</b>" +
          esc(reply.content) + "</div>";
      })
      .catch(function (err) {
        out.innerHTML = '<div class="test-out" style="border-color:rgba(201,86,111,.45)">' +
          "<b>Test failed</b>" + esc(err.message || err) + "</div>";
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = "Test the prompt";
      });
  });

  /* ----------------------------------------------------------------- boot -- */

  Auth.guard().then(function (res) {
    if (!res.user) return;
    state.user = res.user;
    state.session = res.session;

    return Auth.getCompany(res.user.id).then(function (r) {
      if (r.error) throw r.error;
      var me = r.data || {};
      $("#userAvatar").textContent = initials(me.company_name || res.user.email);
      $("#userCompany").classList.remove("skeleton");
      $("#userCompany").textContent = me.company_name || "Staff";
      $("#userEmail").classList.remove("skeleton");
      $("#userEmail").textContent = res.user.email;

      if (!me.is_admin) {
        $("#adminDenied").hidden = false;
        $("#adminDenied").innerHTML =
          "<span><strong>Staff access only</strong>This account is not marked as a Genysis IQ " +
          'admin. <a href="dashboard.html" style="color:var(--blue-soft)">Go to your dashboard</a>.</span>';
        return;
      }

      $("#adminView").hidden = false;
      return loadCompanies();
    });
  }).catch(function (err) {
    console.error("Admin load failed:", err);
  });

  Auth.onAuthChange(function (event) {
    if (event === "SIGNED_OUT") location.replace("login.html");
  });
})();
