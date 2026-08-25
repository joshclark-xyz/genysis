/* =============================================================================
   Genysis IQ - AI chat client
   -----------------------------------------------------------------------------
   Talks to the Genysis IQ chat endpoint:

     POST {AI_API_BASE_URL}/v1/ai/chat?API={key}
     { model, messages: [{role, content}], max_tokens, temperature,
       reasoning_effort }

   The system prompt is NEVER authored here. It comes from the company's
   `system_prompt` column, which only Genysis IQ staff can write (a database
   trigger blocks clients from changing it).
   ============================================================================= */

(function (global) {
  "use strict";

  var cfg = global.GENYSIS_CONFIG || {};

  var DEFAULTS = {
    model: "openai/gpt-oss-120b",
    maxTokens: 1024,
    temperature: 0.7,
    reasoningEffort: "low"
  };

  /* Keeps requests to a sane size - the endpoint is stateless, so the whole
     conversation is re-sent each turn. */
  var MAX_HISTORY = 24;

  function baseUrl() {
    return String(cfg.AI_API_BASE_URL || "").replace(/\/+$/, "");
  }

  function keyFor(company) {
    return (company && company.ai_api_key) || cfg.AI_API_KEY || "";
  }

  function isConfigured(company) {
    return !!(baseUrl() && keyFor(company));
  }

  /** System prompt (from Genysis IQ) + recent turns + what was just typed. */
  function buildMessages(company, history, message) {
    var messages = [];

    var prompt = company && company.system_prompt;
    if (prompt && String(prompt).trim()) {
      messages.push({ role: "system", content: String(prompt).trim() });
    }

    (history || []).slice(-MAX_HISTORY).forEach(function (m) {
      if (m && (m.role === "user" || m.role === "assistant") && m.content) {
        messages.push({ role: m.role, content: m.content });
      }
    });

    messages.push({ role: "user", content: message });
    return messages;
  }

  /**
   * Sends one turn and resolves with the assistant's reply text.
   *
   * @param {object} company  companies row (supplies system_prompt, model, key)
   * @param {Array}  history  prior turns as [{role:'user'|'assistant', content}]
   * @param {string} message  what the person just typed
   * @param {object} [opts]   { signal } to allow cancelling
   */
  function send(company, history, message, opts) {
    opts = opts || {};

    if (!baseUrl()) {
      return Promise.reject(new Error(
        "The AI endpoint is not configured. Set AI_API_BASE_URL in assets/js/supabase-config.js."
      ));
    }
    if (!keyFor(company)) {
      return Promise.reject(new Error(
        "No API key is set for this company. Genysis IQ needs to add one before the assistant can be used."
      ));
    }

    var messages = buildMessages(company, history, message);

    var url = baseUrl() + "/v1/ai/chat?API=" + encodeURIComponent(keyFor(company));

    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: opts.signal,
      body: JSON.stringify({
        model: (company && company.ai_model) || DEFAULTS.model,
        messages: messages,
        max_tokens: DEFAULTS.maxTokens,
        temperature: DEFAULTS.temperature,
        reasoning_effort: DEFAULTS.reasoningEffort
      })
    })
      .then(function (res) {
        return res.text().then(function (text) {
          if (!res.ok) {
            throw new Error(friendlyStatus(res.status, text));
          }
          var data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            throw new Error("The assistant returned a response we could not read.");
          }
          var choice = data.choices && data.choices[0];
          var content = choice && choice.message && choice.message.content;
          if (!content || !String(content).trim()) {
            throw new Error("The assistant returned an empty reply. Please try again.");
          }
          return {
            content: String(content).trim(),
            finishReason: choice.finish_reason,
            usage: data.usage || null
          };
        });
      });
  }

  /**
   * Same as send(), but streams the reply.
   *
   * The endpoint returns OpenAI-style SSE. Each chunk may carry `delta.content`
   * (the answer) or `delta.reasoning` (the model thinking out loud) - only the
   * former is ever surfaced to the client.
   *
   * @param {function} onDelta called with (chunkText, fullTextSoFar)
   * @returns {Promise<{content:string}>} resolves with the complete reply
   */
  function stream(company, history, message, onDelta, opts) {
    opts = opts || {};

    if (!baseUrl()) {
      return Promise.reject(new Error(
        "The AI endpoint is not configured. Set AI_API_BASE_URL in assets/js/supabase-config.js."
      ));
    }
    if (!keyFor(company)) {
      return Promise.reject(new Error(
        "No API key is set for this company. Genysis IQ needs to add one before the assistant can be used."
      ));
    }

    var url = baseUrl() + "/v1/ai/chat?API=" + encodeURIComponent(keyFor(company));

    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: opts.signal,
      body: JSON.stringify({
        model: (company && company.ai_model) || DEFAULTS.model,
        messages: buildMessages(company, history, message),
        max_tokens: DEFAULTS.maxTokens,
        temperature: DEFAULTS.temperature,
        reasoning_effort: DEFAULTS.reasoningEffort,
        stream: true
      })
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) { throw new Error(friendlyStatus(res.status, t)); });
      }
      // No streaming support in this browser - fall back to a single read.
      if (!res.body || !res.body.getReader) {
        return res.text().then(function (t) {
          var full = collectFromSse(t);
          if (full) { onDelta(full, full); return { content: full }; }
          throw new Error("The assistant returned a response we could not read.");
        });
      }
      return consume(res.body.getReader(), onDelta);
    });
  }

  function consume(reader, onDelta) {
    var decoder = new TextDecoder("utf-8");
    var buffer = "";
    var full = "";

    function pump() {
      return reader.read().then(function (r) {
        if (r.done) {
          if (!full.trim()) {
            throw new Error("The assistant returned an empty reply. Please try again.");
          }
          return { content: full.trim() };
        }

        buffer += decoder.decode(r.value, { stream: true });

        // SSE events are separated by a blank line. Keep any partial tail.
        var parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop();

        parts.forEach(function (evt) {
          evt.split(/\r?\n/).forEach(function (line) {
            if (line.indexOf("data:") !== 0) return;
            var body = line.slice(5).trim();
            if (!body || body === "[DONE]") return;

            var data;
            try { data = JSON.parse(body); } catch (e) { return; }

            var delta = ((data.choices || [{}])[0] || {}).delta || {};
            // delta.reasoning is the model's private thinking - never shown.
            if (typeof delta.content === "string" && delta.content) {
              full += delta.content;
              onDelta(delta.content, full);
            }
          });
        });

        return pump();
      });
    }

    return pump();
  }

  /** Pulls the full message out of a complete SSE body (non-streaming fallback). */
  function collectFromSse(text) {
    var out = "";
    String(text).split(/\r?\n/).forEach(function (line) {
      if (line.indexOf("data:") !== 0) return;
      var body = line.slice(5).trim();
      if (!body || body === "[DONE]") return;
      try {
        var d = JSON.parse(body);
        var delta = ((d.choices || [{}])[0] || {}).delta || {};
        if (typeof delta.content === "string") out += delta.content;
      } catch (e) { /* skip malformed frames */ }
    });
    return out.trim();
  }

  function friendlyStatus(status, body) {
    if (status === 401 || status === 403) {
      return "The API key for this company was rejected. Genysis IQ needs to check it.";
    }
    if (status === 404) {
      return "The AI endpoint could not be found. Check AI_API_BASE_URL.";
    }
    if (status === 429) {
      return "The assistant is handling too many requests right now. Please wait a moment and try again.";
    }
    if (status >= 500) {
      return "The assistant is temporarily unavailable. Please try again shortly.";
    }
    var snippet = String(body || "").trim().slice(0, 160);
    return "The assistant could not answer (error " + status + ")" + (snippet ? ": " + snippet : ".");
  }

  /** First user message, trimmed, makes a reasonable conversation title. */
  function titleFrom(message) {
    var t = String(message || "").replace(/\s+/g, " ").trim();
    if (t.length <= 48) return t || "New conversation";
    return t.slice(0, 47).replace(/\s\S*$/, "") + "…";
  }

  global.GenysisChat = {
    isConfigured: isConfigured,
    send: send,
    stream: stream,
    titleFrom: titleFrom
  };
})(window);
