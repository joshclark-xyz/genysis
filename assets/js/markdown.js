/* =============================================================================
   Genysis IQ - markdown rendering for assistant replies
   -----------------------------------------------------------------------------
   Assistant output is untrusted text that we render as HTML, so every string
   goes marked -> DOMPurify -> DOM. DOMPurify is what stops a model (or anything
   that reached the model) from injecting script or event handlers.

   Depends on marked, DOMPurify and highlight.js being loaded first. If any are
   missing the renderer degrades to escaped plain text rather than failing.
   ============================================================================= */

(function (global) {
  "use strict";

  var ready = !!(global.marked && global.DOMPurify);

  if (ready) {
    global.marked.setOptions({
      gfm: true,          // tables, strikethrough, autolinks
      breaks: true,       // a single newline is a line break, as people expect
      headerIds: false,
      mangle: false
    });

    /* Links: open externally, and never leak the referrer or window handle. */
    global.DOMPurify.addHook("afterSanitizeAttributes", function (node) {
      if (node.tagName === "A" && node.getAttribute("href")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer nofollow");
      }
    });
  }

  var ALLOWED_TAGS = [
    "p", "br", "hr", "strong", "em", "del", "s", "b", "i", "u", "mark", "small",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "blockquote",
    "pre", "code", "kbd", "samp",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "a", "span", "div", "sup", "sub"
  ];

  var ALLOWED_ATTR = ["href", "title", "class", "align", "colspan", "rowspan", "start"];

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /**
   * Markdown string -> sanitized HTML string.
   * Falls back to escaped text with line breaks if the libraries are absent.
   */
  function render(text) {
    var src = String(text == null ? "" : text);

    if (!ready) {
      return escapeHtml(src).replace(/\n/g, "<br>");
    }

    var raw;
    try {
      raw = global.marked.parse(src);
    } catch (e) {
      return escapeHtml(src).replace(/\n/g, "<br>");
    }

    return global.DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ALLOWED_TAGS,
      ALLOWED_ATTR: ALLOWED_ATTR,
      // Block javascript:, data:, vbscript: in hrefs.
      ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i
    });
  }

  /**
   * Renders into an element, then syntax-highlights and decorates code blocks.
   * Call with `final` false while streaming to skip the expensive passes.
   */
  function into(el, text, final) {
    el.innerHTML = render(text);
    if (final) {
      highlight(el);
      addCopyButtons(el);
      linkifyTables(el);
    }
  }

  function highlight(root) {
    if (!global.hljs) return;
    [].slice.call(root.querySelectorAll("pre code")).forEach(function (block) {
      if (block.dataset.highlighted) return;
      try {
        global.hljs.highlightElement(block);
        block.dataset.highlighted = "yes";
      } catch (e) { /* an unknown language is not worth breaking the reply for */ }
    });
  }

  /** A copy button on every code block - people paste this into terminals. */
  function addCopyButtons(root) {
    [].slice.call(root.querySelectorAll("pre")).forEach(function (pre) {
      if (pre.querySelector(".code-copy")) return;
      var code = pre.querySelector("code");
      if (!code) return;

      var lang = (code.className.match(/language-([\w-]+)/) || [])[1];
      var bar = document.createElement("div");
      bar.className = "code-bar";
      bar.innerHTML = '<span>' + escapeHtml(lang || "text") + "</span>";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-copy";
      btn.textContent = "Copy";
      btn.addEventListener("click", function () {
        var text = code.textContent;
        var done = function () {
          btn.textContent = "Copied";
          setTimeout(function () { btn.textContent = "Copy"; }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
        } else {
          fallbackCopy(text, done);
        }
      });

      bar.appendChild(btn);
      pre.insertBefore(bar, pre.firstChild);
    });
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:absolute;left:-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { /* nothing else to try */ }
    document.body.removeChild(ta);
  }

  /** Wide tables get their own horizontal scroll rather than breaking layout. */
  function linkifyTables(root) {
    [].slice.call(root.querySelectorAll("table")).forEach(function (t) {
      if (t.parentNode && t.parentNode.classList.contains("table-wrap")) return;
      var wrap = document.createElement("div");
      wrap.className = "table-wrap";
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    });
  }

  global.GenysisMarkdown = {
    isReady: function () { return ready; },
    render: render,
    into: into,
    escapeHtml: escapeHtml
  };
})(window);
