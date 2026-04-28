// portal.js — Guardians of Ganja portal layer
// Auth: Clerk CDN  |  New data: Neon via /api/*  |  Legacy: localStorage (threads, messages, docs)
//
// ─── SETUP ──────────────────────────────────────────────────────────────────
// Replace the placeholder below with your Clerk Publishable Key.
// Get it from: https://dashboard.clerk.com → API Keys → Publishable Key
// (starts with pk_test_ or pk_live_ — this key is safe to be public in browser code)

(function () {
  "use strict";

  var CLERK_PUBLISHABLE_KEY = "REPLACE_WITH_YOUR_CLERK_PUBLISHABLE_KEY";

  // ── Clerk Loader ──────────────────────────────────────────
  var _clerkCallbacks = [];
  var _clerkState = "idle"; // idle | loading | ready

  function loadClerk(callback) {
    if (_clerkState === "ready" && window.Clerk) { callback(window.Clerk); return; }
    _clerkCallbacks.push(callback);
    if (_clerkState === "loading") return;
    _clerkState = "loading";

    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js";
    s.crossOrigin = "anonymous";
    s.onload = function () {
      var clerk = new window.Clerk(CLERK_PUBLISHABLE_KEY);
      clerk.load().then(function () {
        window.Clerk = clerk;
        _clerkState = "ready";
        var cbs = _clerkCallbacks.slice();
        _clerkCallbacks = [];
        cbs.forEach(function (cb) { cb(clerk); });
      }).catch(function (err) {
        console.error("[Portal] Clerk.load() failed:", err);
        _clerkState = "idle";
      });
    };
    s.onerror = function () {
      console.error("[Portal] Failed to load Clerk CDN script");
      _clerkState = "idle";
    };
    document.head.appendChild(s);
  }

  // ── API helpers ───────────────────────────────────────────
  function _getToken() {
    return new Promise(function (resolve) {
      if (window.Clerk && window.Clerk.session) {
        window.Clerk.session.getToken().then(resolve).catch(function () { resolve(null); });
      } else {
        resolve(null);
      }
    });
  }

  function apiFetch(path, options) {
    return _getToken().then(function (token) {
      var headers = Object.assign({ "Content-Type": "application/json" }, (options && options.headers) || {});
      if (token) headers["Authorization"] = "Bearer " + token;
      return fetch(path, Object.assign({}, options, { headers: headers }));
    }).then(function (resp) {
      if (!resp.ok) {
        return resp.json().catch(function () { return { error: resp.statusText }; }).then(function (err) {
          throw new Error(err.error || "API error " + resp.status);
        });
      }
      return resp.json();
    });
  }

  var api = {
    users: {
      getAll: function () { return apiFetch("/api/users"); },
      update: function (id, data) {
        return apiFetch("/api/users", { method: "PATCH", body: JSON.stringify(Object.assign({ id: id }, data)) });
      },
      remove: function (id) {
        return apiFetch("/api/users", { method: "DELETE", body: JSON.stringify({ id: id }) });
      }
    },
    emails: {
      getCampaigns: function () { return apiFetch("/api/email-campaign"); },
      sendCampaign: function (data) {
        return apiFetch("/api/email-campaign", { method: "POST", body: JSON.stringify(data) });
      }
    },
    subscribe: function (data) {
      return fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || "Subscribe failed"); });
        return r.json();
      });
    }
  };

  // ── requireAuth (async, callback-based) ───────────────────
  function requireAuth(requiredRole, callback) {
    loadClerk(function (clerk) {
      if (!clerk.user) {
        window.location.href = "/login";
        return;
      }
      var role = (clerk.user.publicMetadata && clerk.user.publicMetadata.role) || "customer";
      if (requiredRole === "admin" && role !== "admin") {
        window.location.href = "/dashboard";
        return;
      }
      var profile = {
        id:        clerk.user.id,
        email:     clerk.user.primaryEmailAddress
                     ? clerk.user.primaryEmailAddress.emailAddress
                     : "",
        full_name: [clerk.user.firstName, clerk.user.lastName].filter(Boolean).join(" "),
        company:   (clerk.user.unsafeMetadata && clerk.user.unsafeMetadata.company) || "",
        phone:     (clerk.user.unsafeMetadata && clerk.user.unsafeMetadata.phone) || "",
        role:      role
      };
      callback({ profile: profile, clerk: clerk });
    });
  }

  function signOut() {
    loadClerk(function (clerk) {
      clerk.signOut().then(function () { window.location.href = "/login"; });
    });
  }

  // ── localStorage DB (threads, messages, documents) ────────
  var KEYS = {
    threads:   "gog_threads",
    messages:  "gog_messages",
    documents: "gog_documents"
  };

  function readArr(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch (e) { return []; }
  }
  function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function nowIso() { return new Date().toISOString(); }

  var db = {
    threads: {
      getByCustomer: function (customerId) {
        return readArr(KEYS.threads)
          .filter(function (t) { return t.customer_id === customerId; })
          .sort(function (a, b) { return b.last_message_at > a.last_message_at ? 1 : -1; });
      },
      getAll: function () {
        return readArr(KEYS.threads)
          .sort(function (a, b) { return b.last_message_at > a.last_message_at ? 1 : -1; });
      },
      create: function (customerId, subject) {
        var threads = readArr(KEYS.threads);
        var n = nowIso();
        var t = { id: uuid(), customer_id: customerId, subject: subject, created_at: n, last_message_at: n };
        threads.push(t);
        save(KEYS.threads, threads);
        return t;
      }
    },

    messages: {
      getByThread: function (threadId) {
        return readArr(KEYS.messages)
          .filter(function (m) { return m.thread_id === threadId; })
          .sort(function (a, b) { return a.created_at > b.created_at ? 1 : -1; });
      },
      create: function (threadId, senderId, content) {
        var msgs    = readArr(KEYS.messages);
        var threads = readArr(KEYS.threads);
        var n = nowIso();
        var m = { id: uuid(), thread_id: threadId, sender_id: senderId, content: content, read: false, created_at: n };
        msgs.push(m);
        save(KEYS.messages, msgs);
        var ti = threads.findIndex(function (t) { return t.id === threadId; });
        if (ti !== -1) { threads[ti].last_message_at = n; save(KEYS.threads, threads); }
        return m;
      },
      markRead: function (threadId, currentUserId) {
        var msgs = readArr(KEYS.messages);
        msgs.forEach(function (m) {
          if (m.thread_id === threadId && m.sender_id !== currentUserId) m.read = true;
        });
        save(KEYS.messages, msgs);
      }
    },

    documents: {
      getByClient: function (clientId) {
        return readArr(KEYS.documents)
          .filter(function (d) { return d.client_id === clientId; })
          .sort(function (a, b) { return b.created_at > a.created_at ? 1 : -1; });
      },
      create: function (clientId, type, filename, dataUrl, notes, uploadedBy) {
        var docs = readArr(KEYS.documents);
        var d = { id: uuid(), client_id: clientId, type: type, filename: filename, data_url: dataUrl, notes: notes || "", uploaded_by: uploadedBy, created_at: nowIso() };
        docs.push(d);
        save(KEYS.documents, docs);
        return d;
      },
      download: function (docId) {
        var doc = readArr(KEYS.documents).find(function (d) { return d.id === docId; });
        if (!doc || !doc.data_url) return;
        var a = document.createElement("a");
        a.href = doc.data_url;
        a.download = doc.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  };

  // ── Utilities ─────────────────────────────────────────────
  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function formatDateTime(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  }
  function initials(name) {
    if (!name) return "?";
    return name.trim().split(/\s+/).map(function (w) { return w[0]; }).join("").toUpperCase().slice(0, 2);
  }
  function escHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  window.Portal = {
    api:           api,
    db:            db,
    loadClerk:     loadClerk,
    requireAuth:   requireAuth,
    signOut:       signOut,
    formatDate:    formatDate,
    formatDateTime:formatDateTime,
    initials:      initials,
    escHtml:       escHtml
  };
})();

