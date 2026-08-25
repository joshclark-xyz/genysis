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
    maxTokens: Number(cfg.AI_MAX_TOKENS) > 0 ? Number(cfg.AI_MAX_TOKENS) : 1024,
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

  /** Returns an Error when the endpoint or key is missing, otherwise null. */
  function configGuard(company) {
    if (!baseUrl()) {
      return new Error(
        "The AI endpoint is not configured. Set AI_API_BASE_URL in assets/js/supabase-config.js."
      );
    }
    if (!keyFor(company)) {
      return new Error(
        "No API key is set for this company. Genysis IQ needs to add one before the assistant can be used."
      );
    }
    return null;
  }

  function endpointFor(company) {
    return baseUrl() + "/v1/ai/chat?API=" + encodeURIComponent(keyFor(company));
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

    var guard = configGuard(company);
    if (guard) return Promise.reject(guard);

    var url = endpointFor(company);
    var payload = JSON.stringify({
      model: (company && company.ai_model) || DEFAULTS.model,
      messages: buildMessages(company, history, message),
      max_tokens: DEFAULTS.maxTokens,
      temperature: DEFAULTS.temperature,
      reasoning_effort: DEFAULTS.reasoningEffort
    });

    function attempt(n) {
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: opts.signal,
        body: payload
      }).then(function (res) {
        return res.text().then(function (text) {
          if (res.ok) return parseReply(text);

          if (isRetryable(res.status) && n < MAX_ATTEMPTS - 1) {
            var delay = backoffFor(n, retryAfterHeader(res) || parseRetryDelay(text));
            if (opts.onRetry) opts.onRetry(n + 1, delay, res.status);
            return wait(delay).then(function () { return attempt(n + 1); });
          }
          throw new Error(friendlyStatus(res.status, text));
        });
      });
    }

    return attempt(0);
  }

  /** Shared by send() and the non-streaming fallback in stream(). */
  function parseReply(text) {
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

    var guard = configGuard(company);
    if (guard) return Promise.reject(guard);

    var url = endpointFor(company);
    var payload = JSON.stringify({
      model: (company && company.ai_model) || DEFAULTS.model,
      messages: buildMessages(company, history, message),
      max_tokens: DEFAULTS.maxTokens,
      temperature: DEFAULTS.temperature,
      reasoning_effort: DEFAULTS.reasoningEffort,
      stream: true
    });

    /* A 429 arrives as the HTTP response, before any tokens are streamed, so
       retrying is safe here - nothing has been shown to the reader yet. Once
       the body starts flowing we never retry, to avoid duplicating output. */
    function attempt(n) {
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: opts.signal,
        body: payload
      }).then(function (res) {
        if (!res.ok) {
          return res.text().then(function (text) {
            if (isRetryable(res.status) && n < MAX_ATTEMPTS - 1) {
              var delay = backoffFor(n, retryAfterHeader(res) || parseRetryDelay(text));
              if (opts.onRetry) opts.onRetry(n + 1, delay, res.status);
              return wait(delay).then(function () { return attempt(n + 1); });
            }
            throw new Error(friendlyStatus(res.status, text));
          });
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

    return attempt(0);
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

  /* ------------------------------------------------------ rate limiting -- */

  /* The upstream provider enforces a tokens-per-minute budget shared by every
     client on the account. Under concurrent use one request can be refused
     while the rest succeed, which looks random to whoever gets unlucky. Its
     429 body carries a precise hint ("Please try again in 750ms"), so honour
     that and retry rather than surfacing an error the user has to act on. */

  var MAX_ATTEMPTS = 4;
  var MAX_WAIT_MS = 12000;

  /** Pulls "try again in 750ms" / "in 1.5s" out of a 429 body. */
  function parseRetryDelay(body) {
    var text = String(body || "");
    var ms = /try again in\s+([\d.]+)\s*ms/i.exec(text);
    if (ms) return Math.ceil(parseFloat(ms[1]));
    var sec = /try again in\s+([\d.]+)\s*s/i.exec(text);
    if (sec) return Math.ceil(parseFloat(sec[1]) * 1000);
    return null;
  }

  /** Retry-After header wins over anything in the body. */
  function retryAfterHeader(res) {
    var h = res.headers && res.headers.get && res.headers.get("Retry-After");
    if (!h) return null;
    var n = parseFloat(h);
    if (!isNaN(n)) return Math.ceil(n * 1000);
    var when = Date.parse(h);
    return isNaN(when) ? null : Math.max(0, when - Date.now());
  }

  /** Backoff with jitter, so simultaneous clients do not retry in lockstep. */
  function backoffFor(attempt, hinted) {
    var base = hinted != null ? hinted : Math.min(1000 * Math.pow(2, attempt), 8000);
    var jitter = Math.random() * 400;
    return Math.min(base + jitter, MAX_WAIT_MS);
  }

  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function isRetryable(status) {
    return status === 429 || status === 502 || status === 503 || status === 504;
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
