// portal.js — Self-contained localStorage auth + data store
// No external services required. Works immediately.

(function () {
  "use strict";

  var KEYS = {
    users:     "gog_users",
    threads:   "gog_threads",
    messages:  "gog_messages",
    documents: "gog_documents",
    session:   "gog_session"
  };

  var ADMINS = [
    { email: "trav.mcmichael@gmail.com", password: "86238623",  full_name: "Trav McMichael" },
    { email: "mike@lucentengine.ai",    password: "12341234",  full_name: "Mike" }
  ];
  // kept for back-compat with signUp role check
  var ADMIN_EMAIL = "trav.mcmichael@gmail.com";

  // ── Simple hash (prototype — not cryptographic) ──────────
  function hashPassword(pw) {
    var str  = pw + ":gog2026:" + pw.length;
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
      hash = hash >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  // ── Storage helpers ───────────────────────────────────────
  function readArr(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch (e) { return []; }
  }
  function readObj(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch (e) { return null; }
  }
  function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function nowIso() { return new Date().toISOString(); }

  function _strip(u) {
    var c = Object.assign({}, u);
    delete c.password_hash;
    return c;
  }

  // ── Seed admin (runs once) ────────────────────────────────
  function ensureAdmin() {
    var users = readArr(KEYS.users);
    var changed = false;
    ADMINS.forEach(function (a) {
      if (!users.some(function (u) { return u.email.toLowerCase() === a.email.toLowerCase(); })) {
        users.unshift({
          id:            uuid(),
          email:         a.email,
          password_hash: hashPassword(a.password),
          full_name:     a.full_name,
          company:       "Guardians of Ganja",
          phone:         "",
          role:          "admin",
          created_at:    nowIso()
        });
        changed = true;
      }
    });
    if (changed) save(KEYS.users, users);
  }

  // ── Auth ──────────────────────────────────────────────────
  var auth = {
    signIn: function (email, password) {
      var users = readArr(KEYS.users);
      var user  = users.find(function (u) { return u.email.toLowerCase() === email.toLowerCase(); });
      if (!user || user.password_hash !== hashPassword(password)) {
        return { error: { message: "Invalid email or password." } };
      }
      save(KEYS.session, { user_id: user.id, expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000 });
      return { data: { user: _strip(user) }, error: null };
    },

    signUp: function (email, password, meta) {
      var users = readArr(KEYS.users);
      if (users.some(function (u) { return u.email.toLowerCase() === email.toLowerCase(); })) {
        return { error: { message: "An account with this email already exists." } };
      }
      var role = ADMINS.some(function (a) { return a.email.toLowerCase() === email.toLowerCase(); }) ? "admin" : "customer";
      var nu = {
        id:            uuid(),
        email:         email,
        password_hash: hashPassword(password),
        full_name:     meta.full_name || "",
        company:       meta.company  || "",
        phone:         meta.phone    || "",
        role:          role,
        created_at:    nowIso()
      };
      users.push(nu);
      save(KEYS.users, users);
      save(KEYS.session, { user_id: nu.id, expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000 });
      return { data: { user: _strip(nu) }, error: null };
    },

    signOut: function () {
      localStorage.removeItem(KEYS.session);
      window.location.href = "login.html";
    },

    getSession: function () {
      var s = readObj(KEYS.session);
      if (!s || s.expires_at < Date.now()) { localStorage.removeItem(KEYS.session); return null; }
      return s;
    },

    getCurrentUser: function () {
      var s = auth.getSession();
      if (!s) return null;
      var u = readArr(KEYS.users).find(function (u) { return u.id === s.user_id; });
      return u ? _strip(u) : null;
    }
  };

  // ── Database ──────────────────────────────────────────────
  var db = {
    users: {
      getAll: function () { return readArr(KEYS.users).map(_strip); },
      getById: function (id) {
        var u = readArr(KEYS.users).find(function (u) { return u.id === id; });
        return u ? _strip(u) : null;
      },
      update: function (id, fields) {
        var users = readArr(KEYS.users);
        var idx   = users.findIndex(function (u) { return u.id === id; });
        if (idx === -1) return { error: "Not found" };
        delete fields.password_hash;
        Object.assign(users[idx], fields);
        save(KEYS.users, users);
        return { error: null };
      }
    },

    threads: {
      getByCustomer: function (customerId) {
        return readArr(KEYS.threads)
          .filter(function (t) { return t.customer_id === customerId; })
          .sort(function (a, b) { return b.last_message_at > a.last_message_at ? 1 : -1; });
      },
      getAll: function () {
        var users = readArr(KEYS.users);
        return readArr(KEYS.threads)
          .map(function (t) {
            var c = users.find(function (u) { return u.id === t.customer_id; });
            return Object.assign({}, t, { customer_name: c ? (c.full_name || c.email) : "Unknown" });
          })
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
        var users = readArr(KEYS.users);
        return readArr(KEYS.messages)
          .filter(function (m) { return m.thread_id === threadId; })
          .sort(function (a, b) { return a.created_at > b.created_at ? 1 : -1; })
          .map(function (m) {
            var sender = users.find(function (u) { return u.id === m.sender_id; });
            return Object.assign({}, m, {
              sender_name: sender ? (sender.full_name || sender.email) : "Unknown",
              sender_role: sender ? sender.role : "customer"
            });
          });
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

  // ── requireAuth ───────────────────────────────────────────
  function requireAuth(requiredRole) {
    ensureAdmin();
    var user = auth.getCurrentUser();
    if (!user) { window.location.href = "login.html"; return null; }
    if (requiredRole && user.role !== requiredRole) {
      window.location.href = user.role === "admin" ? "admin.html" : "dashboard.html";
      return null;
    }
    return { profile: user };
  }

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

  // Init
  ensureAdmin();

  window.Portal = {
    auth:          auth,
    db:            db,
    requireAuth:   requireAuth,
    signOut:       function () { auth.signOut(); },
    formatDate:    formatDate,
    formatDateTime:formatDateTime,
    initials:      initials,
    escHtml:       escHtml
  };
})();
