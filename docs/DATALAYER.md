# AuraDB — Data Layer Reference (`dataLayer.js`)

**Status:** Phase 0 implemented · loaded after `app.js` in `index.html`
**Dependencies:** none (plain `fetch` + Web Crypto — keeps the app's zero-dependency promise)

---

## What it is

`dataLayer.js` is the dual-backend adapter between Aura Studio and the
personalized database. It loads **after** `app.js` and transparently wraps the
existing storage functions, so the studio behaves exactly as before — with an
optional PostgreSQL (Supabase) backend layered underneath.

| Backend | Storage | When |
|---|---|---|
| **local** | `localStorage` + IndexedDB (today's keys, unchanged) | default, offline, or not signed in |
| **cloud** | Postgres tables + object storage via REST | when configured, signed in, and online |

### How it stays compatible with `app.js`

- **Reads stay synchronous.** On startup the adapter *pulls* cloud data into
  the local stores (cache), so `getBrand()`, `allTemplates()`, `showOpenSaved()`
  etc. keep their current signatures and behavior.
- **Writes are write-through.** `setBrand()`, `setAiCloud()` apply locally
  immediately, then push to the cloud. If the push fails or you're offline,
  the operation is queued (`aura.db.queue`, max 500 ops) and flushed
  automatically on reconnect (`online` event or `AuraDB.flush()`).
- **Credentials never sync.** Device-local member passwords (`aura.members`)
  stay on the device. Cloud identity uses Supabase Auth (JWT).

## Wrapped functions (no app.js edits required)

| Function | Behavior |
|---|---|
| `setBrand(b)` | local write + cloud `brand_kits` upsert |
| `setAiCloud(v)` | local write + cloud `app_settings[key='aiCloud']` upsert |
| `showOpenSaved()` | merges cloud projects with local `aura.project.*` keys; adds a **💾 Save current design to database** button |

## Console / programmatic API

```js
AuraDB.status()                          // { mode, cloudConfigured, signedIn, user, queueLength, online }
AuraDB.configure({ url, key })           // Supabase project URL + anon public key
AuraDB.setMode("local" | "cloud" | "auto")
AuraDB.connect()                         // verify session, pull cloud → cache, flush queue

AuraDB.auth.signIn(email, password)      // Supabase Auth; session persisted
AuraDB.auth.signUp(email, password)
AuraDB.auth.signOut()
AuraDB.auth.user()

AuraDB.pullAll()                         // cloud → local cache (projects, templates, brand, settings, clients)
AuraDB.pushAll()                         // one-time local → cloud migration (designs, custom templates, brand, aiCloud, clients)

AuraDB.projects.list() / save(project) / remove(id)
AuraDB.clients.list() / save(client) / remove(id)
AuraDB.assets.list() / upload(file) / url(path)
AuraDB.savedFiles.list() / upload(blob, { label, kind, type, projectId, clientId })
AuraDB.flush() / clearQueue() / reset()
```

All `projects/clients/assets/savedFiles` methods **degrade gracefully**: cloud
first when active, local fallback otherwise (media falls back to the existing
IndexedDB library; exports to a local `aura.savedFiles` list).

## Tables used (see `DATABASE_DESIGN.md` §3)

`profiles · clients · projects · templates · assets · saved_files · brand_kits · app_settings`

Storage buckets: `assets` (images/videos), `saved-files` (exports), `public`.

## Quick start (first cloud run)

1. Create a Supabase project and run the schema migration (Phase 1 SQL).
2. In the studio console:
   ```js
   AuraDB.configure({ url: "https://xxxx.supabase.co", key: "<anon key>" });
   await AuraDB.auth.signIn("you@example.com", "password");   // or signUp
   await AuraDB.pushAll();     // migrate existing local designs/templates/brand
   await AuraDB.connect();     // verify two-way sync
   ```

## Limits & notes

- Guest mode → local backend only (by design).
- Conflict rule: last-write-wins per project; queued ops replay in order.
- Queue caps at 500 operations (oldest dropped) to protect localStorage.
- `pullAll()` rewrites the local `aura.project.*` keys from cloud — treat
  cloud as source of truth once migration is done.
