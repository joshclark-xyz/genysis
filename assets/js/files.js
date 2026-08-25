/* =============================================================================
   Genysis IQ - file depot client
   -----------------------------------------------------------------------------
   Talks to the Cloudflare Worker in front of the R2 bucket. The Worker verifies
   the caller's Supabase access token and scopes every operation to that
   company's prefix, so nothing here can reach another company's files.

   Contract (see cloudflare/worker.js for the matching implementation):
     GET    {BASE}/files              -> { files: [{ key, name, size, type, uploaded }] }
     POST   {BASE}/files              -> multipart form-data, field "file"
     GET    {BASE}/files/{key}        -> the file itself (or a redirect to it)
     DELETE {BASE}/files/{key}        -> { ok: true }
   ============================================================================= */

(function (global) {
  "use strict";

  var cfg = global.GENYSIS_CONFIG || {};

  var MAX_BYTES = 50 * 1024 * 1024;   // keep in step with the Worker

  function base() {
    return String(cfg.FILES_API_BASE_URL || "").replace(/\/+$/, "");
  }

  function isConfigured() { return !!base(); }

  function authHeaders(session) {
    return { Authorization: "Bearer " + (session ? session.access_token : "") };
  }

  function fail(res) {
    return res.text().then(function (t) {
      var msg;
      if (res.status === 401 || res.status === 403) msg = "Your session has expired. Sign in again.";
      else if (res.status === 413) msg = "That file is too large.";
      else if (res.status === 404) msg = "That file no longer exists.";
      else if (res.status >= 500) msg = "The file service is unavailable. Try again shortly.";
      else {
        try { msg = JSON.parse(t).error; } catch (e) { msg = null; }
        msg = msg || ("Upload failed (error " + res.status + ").");
      }
      throw new Error(msg);
    });
  }

  function list(session) {
    if (!isConfigured()) return Promise.resolve(null);
    return fetch(base() + "/files", { headers: authHeaders(session) })
      .then(function (res) { return res.ok ? res.json() : fail(res); })
      .then(function (d) { return d.files || d.objects || []; });
  }

  /**
   * Uploads one file. Uses XMLHttpRequest rather than fetch so we can report
   * progress, which matters for anything large.
   */
  function upload(session, file, onProgress) {
    if (!isConfigured()) return Promise.reject(new Error("File storage is not configured."));
    if (file.size > MAX_BYTES) {
      return Promise.reject(new Error(
        "“" + file.name + "” is " + humanSize(file.size) +
        ". The limit is " + humanSize(MAX_BYTES) + "."
      ));
    }

    return new Promise(function (resolve, reject) {
      var form = new FormData();
      form.append("file", file, file.name);

      var xhr = new XMLHttpRequest();
      xhr.open("POST", base() + "/files");
      xhr.setRequestHeader("Authorization", "Bearer " + (session ? session.access_token : ""));

      if (xhr.upload && onProgress) {
        xhr.upload.addEventListener("progress", function (e) {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
      }

      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          var data = {};
          try { data = JSON.parse(xhr.responseText); } catch (e) {}
          resolve(data.file || data);
        } else if (xhr.status === 413) {
          reject(new Error("“" + file.name + "” is too large."));
        } else if (xhr.status === 401 || xhr.status === 403) {
          reject(new Error("Your session has expired. Sign in again."));
        } else {
          var msg;
          try { msg = JSON.parse(xhr.responseText).error; } catch (e) {}
          reject(new Error(msg || "Upload failed (error " + xhr.status + ")."));
        }
      };
      xhr.onerror = function () { reject(new Error("Could not reach the file service.")); };
      xhr.onabort = function () { reject(new Error("Upload cancelled.")); };

      xhr.send(form);
    });
  }

  function remove(session, key) {
    if (!isConfigured()) return Promise.reject(new Error("File storage is not configured."));
    return fetch(base() + "/files/" + encodeURIComponent(key), {
      method: "DELETE",
      headers: authHeaders(session)
    }).then(function (res) { return res.ok ? res.json() : fail(res); });
  }

  /** Fetches with auth, then hands the browser a blob so the download works. */
  function download(session, key, name) {
    return fetch(base() + "/files/" + encodeURIComponent(key), { headers: authHeaders(session) })
      .then(function (res) { return res.ok ? res.blob() : fail(res); })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = name || "download";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
  }

  /* ------------------------------------------------------------ helpers -- */

  function humanSize(bytes) {
    var n = Number(bytes) || 0;
    if (n < 1024) return n + " B";
    var units = ["KB", "MB", "GB"], i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
    return (n < 10 ? n.toFixed(1) : Math.round(n)) + " " + units[i];
  }

  /** A coarse category, used to pick the icon and colour. */
  function kindOf(name, type) {
    var ext = String(name || "").split(".").pop().toLowerCase();
    var t = String(type || "").toLowerCase();
    if (t.indexOf("image/") === 0 || /^(png|jpe?g|gif|webp|svg|avif|heic)$/.test(ext)) return "image";
    if (t === "application/pdf" || ext === "pdf") return "pdf";
    if (/^(xlsx?|csv|tsv|numbers)$/.test(ext)) return "sheet";
    if (/^(docx?|rtf|odt|pages|txt|md)$/.test(ext)) return "doc";
    if (/^(zip|rar|7z|tar|gz)$/.test(ext)) return "archive";
    if (t.indexOf("video/") === 0 || /^(mp4|mov|avi|mkv|webm)$/.test(ext)) return "video";
    if (t.indexOf("audio/") === 0 || /^(mp3|wav|m4a|aac|flac)$/.test(ext)) return "audio";
    if (/^(js|ts|jsx|tsx|json|html|css|py|rb|go|rs|java|sql|sh|yml|yaml|xml)$/.test(ext)) return "code";
    return "file";
  }

  global.GenysisFiles = {
    isConfigured: isConfigured,
    list: list,
    upload: upload,
    remove: remove,
    download: download,
    humanSize: humanSize,
    kindOf: kindOf,
    maxBytes: MAX_BYTES
  };
})(window);
