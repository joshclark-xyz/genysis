/* =============================================================================
   Genysis IQ - AI chat client
   -----------------------------------------------------------------------------
   Talks to our own proxy, never to DeepSeek directly:

     POST {AI_API_BASE_URL}/chat          (api/chat.js, a Vercel function)
     Authorization: Bearer {Supabase access token}
     { mode: "dashboard", history, message, stream, draft? }

   The DeepSeek key lives in a Vercel environment variable and is added by the
   proxy. It is never in this file, never in the page, and never in the
   browser's network tab.

   The proxy also owns the system prompt and model: it loads them from the
   company's row using the caller's token. The browser only sends the
   conversation. The one exception is `draft` - an unsaved prompt being tested
   before saving - which the proxy accepts only from staff and from companies
   allowed to write their own assistant.
   ============================================================================= */

(function (global) {
  "use strict";

  var cfg = global.GENYSIS_CONFIG || {};

  /* Keeps requests to a sane size - the endpoint is stateless, so the whole
     conversation is re-sent each turn. The proxy enforces its own cap too. */
  var MAX_HISTORY = 24;

  function endpoint() {
    return String(cfg.AI_API_BASE_URL || "/api").replace(/\/+$/, "") + "/chat";
  }

  /* The key is server-side now, so the browser cannot know whether it is set.
     The proxy answers a clear "not connected yet" if it is missing. */
  function isConfigured() {
    return Boolean(endpoint());
  }

  /**
   * Asks the proxy whether a DeepSeek key is set. Resolves with
   * { configured: boolean, reachable: boolean }. Never rejects.
   */
  function status() {
    return fetch(endpoint(), { method: "GET", cache: "no-store" })
      .then(function (res) {
        if (!res.ok) return { configured: false, reachable: false };
        return res.json().then(function (d) {
          return { configured: Boolean(d && d.configured), reachable: true };
        });
      })
      .catch(function () { return { configured: false, reachable: false }; });
  }

  function accessToken() {
    var auth = global.GenysisAuth;
    if (!auth || !auth.isConfigured()) {
      return Promise.reject(new Error("Please sign in to use the assistant."));
    }
    return auth.client().auth.getSession().then(function (r) {
      var token = r && r.data && r.data.session && r.data.session.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      return token;
    });
  }

  function cleanHistory(history) {
    return (history || []).slice(-MAX_HISTORY).filter(function (m) {
      return m && (m.role === "user" || m.role === "assistant") && m.content;
    }).map(function (m) {
      return { role: m.role, content: m.content };
    });
  }

  /** The request body. `company` is only read when testing a draft. */
  function bodyFor(company, history, message, opts, stream) {
    var body = {
      mode: "dashboard",
      history: cleanHistory(history),
      message: message,
      stream: Boolean(stream)
    };
    if (opts && opts.draft && company) {
      body.draft = {
        systemPrompt: company.system_prompt || "",
        model: company.ai_model || undefined,
        apiKey: company.ai_api_key || undefined
      };
    }
    return JSON.stringify(body);
  }

  function post(token, payload, signal) {
    return fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      signal: signal,
      body: payload
    });
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
    var payload = bodyFor(company, history, message, opts, false);

    return accessToken().then(function (token) {
      function attempt(n) {
        return post(token, payload, opts.signal).then(function (res) {
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
    });
  }

  /** Shared by send() and the non-streaming fallback in stream(). */
  function parseReply(text) {
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("The assistant returned a response we could not read.");
    }
    // The proxy returns { content, finishReason } - only what gets rendered.
    var content = data && data.content;
    if (!content || !String(content).trim()) {
      throw new Error("The assistant returned an empty reply. Please try again.");
    }
    return {
      content: String(content).trim(),
      finishReason: data.finishReason || null
    };
  }

  /**
   * Same as send(), but streams the reply.
   *
   * The endpoint returns OpenAI-style SSE. Each chunk may carry `delta.content`
   * (the answer) or `delta.reasoning_content` (the model thinking out loud) -
   * only the former is ever surfaced to the client.
   *
   * @param {function} onDelta called with (chunkText, fullTextSoFar)
   * @returns {Promise<{content:string}>} resolves with the complete reply
   */
  function stream(company, history, message, onDelta, opts) {
    opts = opts || {};
    var payload = bodyFor(company, history, message, opts, true);

    return accessToken().then(function (token) {
      /* A 429 arrives as the HTTP response, before any tokens are streamed, so
         retrying is safe here - nothing has been shown to the reader yet. Once
         the body starts flowing we never retry, to avoid duplicating output. */
      function attempt(n) {
        return post(token, payload, opts.signal).then(function (res) {
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
            // delta.reasoning_content is the model's private thinking - never shown.
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

  /* DeepSeek throttles by concurrency (the limit scales with the account's
     remaining balance), not by a tokens-per-minute budget shared across all
     clients the way the old free-tier setup did. Under concurrent use a
     request can still be refused with 429 while others succeed, and 5xx
     happen occasionally, so both are retried with backoff and jitter rather
     than surfaced as an error the user has to act on. */

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

  /* The proxy already writes a person-readable message for every failure, so
     prefer it. The status fallbacks cover the proxy itself being unreachable. */
  function friendlyStatus(status, body) {
    try {
      var parsed = JSON.parse(body);
      if (parsed && parsed.error && parsed.error.message) return parsed.error.message;
    } catch (e) { /* not JSON - fall through */ }

    if (status === 404) {
      return "The assistant service could not be found. If you are running the site " +
             "locally, start it with `vercel dev` rather than a plain static server.";
    }
    if (status === 429) {
      return "The assistant is handling too many requests right now. Please wait a moment and try again.";
    }
    if (status >= 500) {
      return "The assistant is temporarily unavailable. Please try again shortly.";
    }
    return "The assistant could not answer (error " + status + ").";
  }

  /** First user message, trimmed, makes a reasonable conversation title. */
  function titleFrom(message) {
    var t = String(message || "").replace(/\s+/g, " ").trim();
    if (t.length <= 48) return t || "New conversation";
    return t.slice(0, 47).replace(/\s\S*$/, "") + "…";
  }

  global.GenysisChat = {
    isConfigured: isConfigured,
    status: status,
    send: send,
    stream: stream,
    titleFrom: titleFrom
  };
})(window);
