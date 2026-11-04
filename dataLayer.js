/* ============================================================
   AuraDB — Aura Studio Data Layer (dual-backend adapter)
   ------------------------------------------------------------
   Phase 0 of the Personalized Database rollout (see
   docs/DATABASE_DESIGN.md). Loads AFTER app.js and wraps the
   existing storage functions so the studio keeps working with
   zero call-site changes, while every write can mirror to a
   PostgreSQL backend (Supabase-compatible REST).

   Backends
     local : localStorage + IndexedDB   (today's behavior, default)
     cloud : Postgres tables + object storage over REST

   Design rules
     - Reads stay SYNCHRONOUS for app.js: on startup the adapter
       pulls cloud data into the local stores (cache), so the app
       reads local and stays fast/offline-friendly.
     - Writes are WRITE-THROUGH: applied locally immediately,
       then queued and pushed to the cloud when reachable.
     - No plaintext passwords or member credentials ever leave
       the device. Cloud auth is separate (Supabase Auth).
     - No external libraries — plain fetch + Web Crypto.

   Console API (after load):
     AuraDB.status()
     AuraDB.configure({ url, key })          // Supabase project URL + anon key
     AuraDB.connect()                        // verify, pull cloud -> local cache
     AuraDB.auth.signIn(email, password)     // cloud member sign-in
     AuraDB.auth.signUp(email, password)
     AuraDB.auth.signOut()
     AuraDB.pushAll()                        // one-time local -> cloud migration
     AuraDB.setMode("local" | "cloud" | "auto")
   ============================================================ */
"use strict";

const AuraDB = (() => {

  /* ================= configuration ================= */
  const CFG_KEY = "aura.db.config";
  const SESSION_KEY = "aura.db.session";
  const QUEUE_KEY = "aura.db.queue";

  let cfg = { url: "", key: "", mode: "local" };   // mode: local | cloud | auto
  let session = null;                              // { access_token, refresh_token, user }
  let flushing = false;

  try { Object.assign(cfg, JSON.parse(localStorage.getItem(CFG_KEY) || "{}")); } catch (e) {}
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) {}

  function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {} }
  function saveSession() {
    if (session) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {} }
    else try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function cloudConfigured() { return !!(cfg.url && cfg.key); }
  function wantsCloud() {
    return cloudConfigured() &&
      (cfg.mode === "cloud" || (cfg.mode === "auto" && navigator.onLine));
  }

  /* ================= Supabase-compatible REST client ================= */
  function apiUrl(path) { return cfg.url.replace(/\/+$/, "") + path; }

  function apiHeaders(extra) {
    const h = Object.assign({
      "apikey": cfg.key,
      "Content-Type": "application/json",
    }, extra || {});
    if (session && session.access_token) h["Authorization"] = "Bearer " + session.access_token;
    else h["Authorization"] = "Bearer " + cfg.key;
    return h;
  }

  async function rest(table, opts) {
    // opts: { method, query, body, prefer }
    let url = apiUrl("/rest/v1/" + table);
    if (opts && opts.query) url += opts.query;
    const res = await fetch(url, {
      method: (opts && opts.method) || "GET",
      headers: apiHeaders(opts && opts.prefer ? { "Prefer": opts.prefer } : null),
      body: opts && opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error("DB " + res.status + " on " + table + ": " + (text || res.statusText));
    }
    if ((opts && opts.method) === "DELETE") return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  /* ---------------- auth (Supabase Auth) ---------------- */
  async function authSignIn(email, password) {
    const res = await fetch(apiUrl("/auth/v1/token?grant_type=password"), {
      method: "POST",
      headers: { "apikey": cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error("Sign-in failed (" + res.status + ") — check email/password");
    const data = await res.json();
    session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
    saveSession();
    await ensureProfile(data.user);
    return session.user;
  }

  async function authSignUp(email, password) {
    const res = await fetch(apiUrl("/auth/v1/signup"), {
      method: "POST",
      headers: { "apikey": cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error("Sign-up failed (" + res.status + ")");
    const data = await res.json();
    if (data.access_token) {
      session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
      saveSession();
      await ensureProfile(data.user);
    }
    return data; // may require email confirmation depending on project settings
  }

  async function authRefresh() {
    if (!session || !session.refresh_token) return null;
    const res = await fetch(apiUrl("/auth/v1/token?grant_type=refresh_token"), {
      method: "POST",
      headers: { "apikey": cfg.key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) { signOut(); return null; }
    const data = await res.json();
    session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
    saveSession();
    return session;
  }

  function signOut() { session = null; saveSession(); }

  async function ensureProfile(user) {
    // profiles row is created by DB trigger usually; patch display data if missing.
    try {
      await rest("profiles", {
        method: "POST",
        body: { id: user.id, username: (user.email || "member").split("@")[0], display_name: (user.email || "member").split("@")[0] },
        prefer: "resolution=merge-duplicates",
      });
    } catch (e) { /* trigger likely handled it */ }
  }

  /* ---------------- request retry with token refresh ---------------- */
  async function withCloud(fn) {
    if (!wantsCloud()) return null;
    try { return await fn(); }
    catch (e) {
      if (/\b401\b|JWT|expired/i.test(e.message)) {
        const s = await authRefresh();
        if (s) return fn();
      }
      throw e;
    }
  }

  /* ================= OFFLINE WRITE QUEUE ================= */
  function queueGet() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch (e) { return []; }
  }
  function queuePush(op) {
    const q = queueGet();
    q.push(op);
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-500))); } catch (e) {}
  }
  async function flushQueue() {
    if (flushing || !wantsCloud()) return;
    flushing = true;
    try {
      const q = queueGet();
      const remaining = [];
      for (const op of q) {
        try { await applyToCloud(op); }
        catch (e) {
          if (!/\b401\b|JWT|expired/i.test(e.message)) remaining.push(op);
        }
      }
      try { localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining)); } catch (e) {}
    } finally { flushing = false; }
  }
  window.addEventListener("online", () => flushQueue());

  /* ================= LOCAL STORES (mirror of current app keys) ================= */
  function memberKey(base) {
    // mirrors app.js mkey(): namespaced per signed-in member
    let u = null;
    try { u = JSON.parse(localStorage.getItem("aura.currentMember") || "null"); } catch (e) {}
    return u ? "aura.m." + u + "." + base : base;
  }
  function jsonGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch (e) { return fallback; }
  }
  function jsonSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  const Local = {
    brand: {
      get() { return jsonGet(memberKey("aura.brand"), { colors: [], font: "", logo: "" }); },
      set(b) { jsonSet(memberKey("aura.brand"), b); },
    },
    customTemplates: {
      get() { return jsonGet(memberKey("aura.templates.custom"), []); },
      set(list) { jsonSet(memberKey("aura.templates.custom"), list); },
    },
    settings: {
      get(key, fallback) {
        const all = jsonGet(memberKey("aura.settings"), {});
        return key in all ? all[key] : fallback;
      },
      set(key, val) {
        const all = jsonGet(memberKey("aura.settings"), {});
        all[key] = val;
        jsonSet(memberKey("aura.settings"), all);
      },
    },
    projects: {
      // saved designs live under top-level "aura.project.<id>" keys
      list() {
        return Object.keys(localStorage)
          .filter(k => k.startsWith("aura.project."))
          .map(k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } })
          .filter(Boolean);
      },
      get(id) { return jsonGet("aura.project." + id, null); },
      save(p) { jsonSet("aura.project." + (p.id || p.name), p); },
    },
    clients: {
      list() { return jsonGet(memberKey("aura.clients"), []); },
      set(list) { jsonSet(memberKey("aura.clients"), list); },
    },
    savedFiles: {
      list() { return jsonGet(memberKey("aura.savedFiles"), []); },
      set(list) { jsonSet(memberKey("aura.savedFiles"), list); },
    },
  };

  /* ================= CLOUD OPERATIONS ================= */
  function ownerId() { return session && session.user ? session.user.id : null; }

  async function applyToCloud(op) {
    const uid = ownerId();
    if (!uid) throw new Error("not signed in to cloud");
    switch (op.op) {
      case "brand.set":
        await rest("brand_kits", {
          method: "POST",
          body: { owner_id: uid, colors: op.colors || [], font: op.font || "", logo_path: op.logo || null },
          prefer: "resolution=merge-duplicates",
        });
        break;
      case "settings.set":
        await rest("app_settings", {
          method: "POST",
          body: { owner_id: uid, key: op.key, value: op.value },
          prefer: "resolution=merge-duplicates",
        });
        break;
      case "project.save": {
        const p = op.project;
        await rest("projects", {
          method: "POST",
          prefer: "resolution=merge-duplicates",
          body: {
            id: p.id, owner_id: uid, name: p.name || "Untitled design",
            category: p.cat || "custom", width: p.w || 850, height: p.h || 1100,
            data: p, client_id: p.clientId || null,
          },
        });
        break;
      }
      case "project.delete":
        await rest("projects", { method: "DELETE", query: "?id=eq." + op.id });
        break;
      case "template.save": {
        const t = op.template;
        await rest("templates", {
          method: "POST",
          prefer: "resolution=merge-duplicates",
          body: {
            id: t.id, owner_id: uid, name: t.name || "Custom template",
            category: t.cat || "custom", width: t.w || 850, height: t.h || 1100,
            data: t, version: t.version || null,
          },
        });
        break;
      }
      case "client.save": {
        const c = op.client;
        await rest("clients", {
          method: "POST",
          prefer: "resolution=merge-duplicates",
          body: {
            id: c.id, owner_id: uid, name: c.name || "Client",
            contact_email: c.email || null, contact_phone: c.phone || null,
            notes: c.notes || null, custom_fields: c.custom || {}, archived: !!c.archived,
          },
        });
        break;
      }
      case "client.delete":
        await rest("clients", { method: "DELETE", query: "?id=eq." + op.id });
        break;
      case "savedfile.save": {
        const f = op.file;
        await rest("saved_files", {
          method: "POST",
          prefer: "resolution=merge-duplicates",
          body: {
            id: f.id, owner_id: uid, project_id: f.projectId || null,
            client_id: f.clientId || null, kind: f.kind || "other", label: f.label || f.name,
            storage_path: f.storage_path, mime_type: f.type || null, size_bytes: f.size || 0,
          },
        });
        break;
      }
      default:
        break; // unknown op — drop it rather than loop forever
    }
  }

  const Cloud = {
    async brandGet() {
      const rows = await rest("brand_kits", { query: "?owner_id=eq." + ownerId() + "&select=*", method: "GET" });
      const r = rows && rows[0];
      return r ? { colors: r.colors || [], font: r.font || "", logo: r.logo_path || "" }
               : { colors: [], font: "", logo: "" };
    },
    async projectsList() {
      return (await rest("projects", {
        method: "GET",
        query: "?owner_id=eq." + ownerId() + "&select=data&order=updated_at.desc",
      })) || [];
    },
    async templatesList() {
      return (await rest("templates", {
        method: "GET",
        query: "?owner_id=eq." + ownerId() + "&select=data&order=created_at.desc",
      })) || [];
    },
    async settingsAll() {
      const rows = (await rest("app_settings", {
        method: "GET", query: "?owner_id=eq." + ownerId() + "&select=key,value",
      })) || [];
      const out = {};
      rows.forEach(r => { out[r.key] = r.value; });
      return out;
    },
    async clientsList() {
      return (await rest("clients", {
        method: "GET",
        query: "?owner_id=eq." + ownerId() + "&select=*",
      })) || [];
    },
    async assetUpload(file) {
      const uid = ownerId();
      const id = uuid();
      const path = uid + "/" + id + "/" + (file.name || "asset");
      const res = await fetch(apiUrl("/storage/v1/object/assets/" + path), {
        method: "POST",
        headers: apiHeaders({ "Content-Type": file.type || "application/octet-stream",
                              "x-upsert": "true" }),
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed (" + res.status + ")");
      const kind = (file.type || "").startsWith("video") ? "video"
                 : (file.type || "").startsWith("audio") ? "audio" : "image";
      await rest("assets", {
        method: "POST", prefer: "resolution=merge-duplicates",
        body: {
          id, owner_id: uid, kind, filename: file.name || "asset", storage_path: path,
          mime_type: file.type || null, size_bytes: file.size || 0, insertable: kind === "image",
        },
      });
      return { id, storage_path: path };
    },
    assetUrl(path) {
      return apiUrl("/storage/v1/object/public/assets/" + path);
    },
    async assetList() {
      return (await rest("assets", {
        method: "GET",
        query: "?owner_id=eq." + ownerId() + "&select=*&order=created_at.desc",
      })) || [];
    },
    async savedFileUpload(blob, meta) {
      const uid = ownerId();
      const id = uuid();
      const path = uid + "/" + id + "/" + (meta.label || "export");
      const res = await fetch(apiUrl("/storage/v1/object/saved-files/" + path), {
        method: "POST",
        headers: apiHeaders({ "Content-Type": meta.type || "application/octet-stream", "x-upsert": "true" }),
        body: blob,
      });
      if (!res.ok) throw new Error("Upload failed (" + res.status + ")");
      await applyToCloud({ op: "savedfile.save", file: Object.assign({ id, storage_path: path, size: blob.size }, meta) });
      return { id, storage_path: path };
    },
  };

  function uuid() {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID()
      : "xxxxxxxxyxxxxyxxxxyxxxxyxxxxxxx".replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
        });
  }

  /* ================= PUBLIC API ================= */
  const api = {

    /* ---- setup / status ---- */
    configure(opts) {
      if (opts.url != null) cfg.url = opts.url;
      if (opts.key != null) cfg.key = opts.key;
      if (opts.mode != null) cfg.mode = opts.mode;
      saveCfg();
      return api.status();
    },
    setMode(mode) { return api.configure({ mode }); },
    status() {
      return {
        mode: cfg.mode,
        cloudConfigured: cloudConfigured(),
        signedIn: !!(session && session.user),
        user: session && session.user ? session.user.email : null,
        queueLength: queueGet().length,
        online: navigator.onLine,
      };
    },

    /* ---- connect: verify creds + pull cloud into local cache ---- */
    async connect() {
      if (!cloudConfigured()) throw new Error("Call AuraDB.configure({url, key}) first");
      if (session && session.refresh_token) await authRefresh();
      if (!session) throw new Error("Not signed in — use AuraDB.auth.signIn(email, password)");
      await api.pullAll();
      await flushQueue();
      return api.status();
    },

    /* ---- cloud -> local cache (keeps app.js sync reads valid) ---- */
    async pullAll() {
      if (!wantsCloud()) return { pulled: 0 };
      let n = 0;
      try {
        const projects = await Cloud.projectsList();
        // remove stale project keys before rewriting
        Object.keys(localStorage).filter(k => k.startsWith("aura.project."))
          .forEach(k => localStorage.removeItem(k));
        for (const row of projects) {
          if (row && row.data) { Local.projects.save(row.data); n++; }
        }
      } catch (e) { console.warn("[AuraDB] projects pull:", e.message); }
      try {
        const tpls = await Cloud.templatesList();
        const custom = tpls.map(r => r.data).filter(Boolean);
        if (custom.length) { Local.customTemplates.set(custom); n += custom.length; }
      } catch (e) { console.warn("[AuraDB] templates pull:", e.message); }
      try {
        Local.brand.set(await Cloud.brandGet()); n++;
      } catch (e) { console.warn("[AuraDB] brand pull:", e.message); }
      try {
        const s = await Cloud.settingsAll();
        if (s.aiCloud != null) jsonSet("aura.aiCloud", JSON.stringify(s.aiCloud));
        n += Object.keys(s).length;
      } catch (e) { console.warn("[AuraDB] settings pull:", e.message); }
      try {
        const cs = await Cloud.clientsList();
        if (cs.length) { Local.clients.set(cs); n += cs.length; }
      } catch (e) { console.warn("[AuraDB] clients pull:", e.message); }
      return { pulled: n };
    },

    /* ---- local -> cloud one-time migration ---- */
    async pushAll() {
      if (!wantsCloud()) throw new Error("Cloud not active (configure + sign in, mode != local)");
      const ops = [];
      const brand = Local.brand.get();
      if (brand && (brand.colors.length || brand.font || brand.logo)) {
        ops.push({ op: "brand.set", colors: brand.colors, font: brand.font, logo: brand.logo });
      }
      const ai = jsonGet("aura.aiCloud", null);
      if (ai) ops.push({ op: "settings.set", key: "aiCloud", value: ai });
      for (const p of Local.projects.list()) {
        if (!p.id) p.id = uuid();
        ops.push({ op: "project.save", project: p });
      }
      for (const t of Local.customTemplates.get()) {
        if (!t.id) t.id = uuid();
        ops.push({ op: "template.save", template: t });
      }
      for (const c of Local.clients.list()) {
        if (!c.id) c.id = uuid();
        ops.push({ op: "client.save", client: c });
      }
      for (const op of ops) {
        try { await applyToCloud(op); }
        catch (e) { queuePush(op); }
      }
      await flushQueue();
      return { pushed: ops.length, queued: queueGet().length };
    },

    /* ---- auth ---- */
    auth: {
      signIn: authSignIn,
      signUp: authSignUp,
      signOut,
      user() { return session && session.user ? session.user : null; },
    },

    /* ---- explicit async CRUD for new features (Phase 2+) ---- */
    projects: {
      async list() {
        if (wantsCloud()) {
          try { return await Cloud.projectsList(); } catch (e) { /* fall through */ }
        }
        return Local.projects.list();
      },
      async save(project) {
        if (!project.id) project.id = uuid();
        Local.projects.save(project);
        if (wantsCloud()) {
          try { await applyToCloud({ op: "project.save", project }); }
          catch (e) { queuePush({ op: "project.save", project }); }
        }
        return project;
      },
      async remove(id) {
        localStorage.removeItem("aura.project." + id);
        if (wantsCloud()) {
          try { await applyToCloud({ op: "project.delete", id }); }
          catch (e) { queuePush({ op: "project.delete", id }); }
        }
      },
    },
    clients: {
      async list() {
        if (wantsCloud()) {
          try { return await Cloud.clientsList(); } catch (e) { /* fall through */ }
        }
        return Local.clients.list();
      },
      async save(client) {
        if (!client.id) client.id = uuid();
        const list = Local.clients.list().filter(c => c.id !== client.id);
        list.unshift(client);
        Local.clients.set(list);
        if (wantsCloud()) {
          try { await applyToCloud({ op: "client.save", client }); }
          catch (e) { queuePush({ op: "client.save", client }); }
        }
        return client;
      },
      async remove(id) {
        Local.clients.set(Local.clients.list().filter(c => c.id !== id));
        if (wantsCloud()) {
          try { await applyToCloud({ op: "client.delete", id }); }
          catch (e) { queuePush({ op: "client.delete", id }); }
        }
      },
    },
    assets: {
      async list() {
        if (wantsCloud()) {
          try { return await Cloud.assetList(); } catch (e) { /* fall through */ }
        }
        // local: media library records from IndexedDB (if app.js loaded)
        if (typeof mediaAll === "function") return mediaAll();
        return [];
      },
      async upload(file) {
        if (wantsCloud()) return Cloud.assetUpload(file);
        // local fallback mirrors app.js mediaPut (dataURL)
        const src = await new Promise(res => {
          const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file);
        });
        const rec = { id: uuid(), name: file.name, type: file.type, data: src, added: Date.now() };
        if (typeof mediaPut === "function") await mediaPut(rec);
        return rec;
      },
      url(path) { return Cloud.assetUrl(path); },
    },
    savedFiles: {
      async list() {
        if (wantsCloud()) {
          try {
            return (await rest("saved_files", {
              method: "GET",
              query: "?owner_id=eq." + ownerId() + "&select=*&order=created_at.desc",
            })) || [];
          } catch (e) { /* fall through */ }
        }
        return Local.savedFiles.list();
      },
      async upload(blob, meta) {
        if (wantsCloud()) return Cloud.savedFileUpload(blob, meta);
        const rec = Object.assign({ id: uuid(), added: Date.now(), size: blob.size }, meta);
        const list = Local.savedFiles.list(); list.unshift(rec);
        Local.savedFiles.set(list);
        return rec;
      },
    },

    /* ---- maintenance ---- */
    async flush() { await flushQueue(); return api.status(); },
    clearQueue() { try { localStorage.removeItem(QUEUE_KEY); } catch (e) {} },
    reset() {
      cfg = { url: "", key: "", mode: "local" }; saveCfg();
      signOut(); api.clearQueue();
    },
  };

  /* ================= APP.JS INTEGRATION (transparent wrappers) ================= */
  // app.js must already be evaluated (load this file after it).
  function wrap(name, wrapper) {
    if (typeof window[name] !== "function") return;
    const orig = window[name];
    try { window[name] = wrapper(orig); } catch (e) { /* non-writable, skip */ }
  }

  // Brand kit — write-through to cloud.
  wrap("setBrand", orig => function (b) {
    orig.call(this, b);
    if (wantsCloud()) {
      const op = { op: "brand.set", colors: b.colors || [], font: b.font || "", logo: b.logo || "" };
      applyToCloud(op).catch(() => queuePush(op));
    }
  });

  // App settings (AI cloud endpoint/key) — write-through to cloud.
  wrap("setAiCloud", orig => function (v) {
    orig.call(this, v);
    if (wantsCloud()) {
      const op = { op: "settings.set", key: "aiCloud", value: v };
      applyToCloud(op).catch(() => queuePush(op));
    }
  });

  // Saved-designs dialog — merge cloud projects into the local list and
  // offer a one-click "save current design to database" action.
  wrap("showOpenSaved", orig => function () {
    if (!wantsCloud()) return orig.call(this);
    AuraDB.projects.list().then(cloudRows => {
      const cloudDocs = (cloudRows || [])
        .map(r => (r && r.data) ? r.data : r)
        .filter(Boolean);
      const local = Local.projects.list();
      const seen = new Set(local.map(p => (p.id || p.name)));
      const merged = local.concat(cloudDocs.filter(p => !seen.has(p.id || p.name)));
      if (!merged.length) { toast("No saved designs yet — use Save to browser first"); return; }
      showModal(`<h3>Open saved design</h3>` +
        (project ? `<div class="m-actions" style="margin-bottom:10px"><button class="abtn primary" id="dbSaveNow">\u{1F4BE} Save current design to database</button></div>` : "") +
        merged.map(p => `<button class="prop-btn" data-k="${esc(p.id || p.name)}">\uD83D\uDCC4 ${esc(p.name || p.id)} <span style="color:#888">(${p.w}\u00d7${p.h})</span></button>`).join("") +
        `<div class="m-actions"><button class="abtn ghost" data-close>Close</button></div>`);
      const saveNow = $("#dbSaveNow");
      if (saveNow) saveNow.onclick = async () => {
        saveNow.disabled = true;
        try {
          await AuraDB.projects.save(project);
          toast("Saved to database" + (navigator.onLine ? "" : " (queued for sync)"));
          closeModal();
        } catch (e) { toast("Save failed: " + e.message); saveNow.disabled = false; }
      };
      $$("#modalCard [data-k]").forEach(b => b.onclick = () => { closeModal();
        project = hydrate(JSON.parse(localStorage.getItem("aura.project." + b.dataset.k) || "null") ||
                          merged.find(p => (p.id || p.name) === b.dataset.k));
        curPage = 0; undoStack = []; openEditor(); });
      $("#modalCard [data-close]").onclick = closeModal;
    }).catch(() => orig.call(this));
  });

  // Startup: if cloud is configured and signed in, refresh the local cache
  // quietly and flush pending writes.
  if (wantsCloud()) {
    window.addEventListener("load", () => {
      if (api.auth.user()) api.pullAll().then(() => flushQueue()).catch(() => {});
      else flushQueue().catch(() => {});
    });
  }

  return api;
})();

/* make available to admin agent and console */
window.AuraDB = AuraDB;
