# Aura Container Sync Architecture — Offline-First, Encrypted, Self-Verifying

**Version:** 0.1 (Draft)
**Date:** 2026-11-04
**Related:** `DATABASE_DESIGN.md` (schema), `DATALAYER.md` (adapter), `.github/workflows/deploy.yml`
**Status:** Documentation phase — containers to be built per §8 roadmap

---

## 1. What this document specifies

A **container-specific architecture**, portable across operating systems and
layered by function, that gives Aura Studio a **GitHub-like versioning system
for both code and data** which works:

- **locally** (single machine, no internet),
- **offline** (full functionality, queued changes),
- **online** (encrypted sync with a remote), and always inside an
  **encrypted environment**, with an **automated regression suite that runs at
  every internet-connection session**, cross-referencing **new pushes**
  (commits) against **new regulations** (Regulations.AI tracker feed).

One sentence: *every device is a self-verifying, encrypted, versioned node;
the network is optional; the connection event is the trigger.*

---

## 2. Design principles

1. **Offline-first.** The local node is fully functional with zero network.
   The network improves freshness; it is never a dependency.
2. **Everything is a commit.** Code and data snapshots live in the same
   content-addressed, git-like store — diffs, history, rollback, blame.
3. **Encrypt by default.** Data at rest is unreadable without device keys;
   data in transit is TLS/SSH only. No plaintext payloads leave a device.
4. **Trust is earned per session.** A sync session must pass regression
   before it may push or pull. A failing build never contaminates the remote.
5. **Cross-reference at the connection event.** Each session produces one
   auditable record: which commits moved, which regulations moved, and how
   they relate.

---

## 3. Application layers (the container stack)

Every participating device runs the same five layers as containers. Layers
are independent processes with defined contracts, so each can be upgraded,
restarted, or replaced without touching the others.

```
┌──────────────────────────────────────────────────────────────┐
│ L5  INTERFACE      Aura Studio UI (browser; served or file)  │
├──────────────────────────────────────────────────────────────┤
│ L4  GUARDIAN       session trigger · regression suite ·      │
│                    regulation cross-reference · reporting    │
│      L4B REG-CHECK industry regulatory box (VMSB):           │
│                    ensemble cross-check vs Gemini/ChatGPT/   │
│                    Grok + official sources, consensus engine │
├──────────────────────────────────────────────────────────────┤
│ L3  SYNC ENGINE    git-like versioning · bundle/encrypt ·    │
│                    merge/rebase · remote transport           │
├──────────────────────────────────────────────────────────────┤
│ L2  DATA           PostgreSQL (+ storage volume for blobs)   │
├──────────────────────────────────────────────────────────────┤
│ L1  OS RUNTIME     container engine per OS (see §4)          │
└──────────────────────────────────────────────────────────────┘
```

| Layer | Container | Responsibility | State |
|---|---|---|---|
| L5 Interface | none (static files) or `nginx` | serves `index.html`, `app.js`, `dataLayer.js` | stateless |
| L4 Guardian | `aura-guardian` | watches for the connection event; runs regression; fetches regulation deltas; writes session report | local reports volume |
| L4B Reg-Check | `aura-regcheck` | industry-specific regulatory AI box: cross-checks VMSB regulatory conclusions against a multi-model ensemble (Gemini, ChatGPT, Grok, …) and authoritative official sources; emits consensus verdicts with citations | verdicts volume (encrypted) |
| L3 Sync | `aura-sync` | snapshots data → encrypted bundle → versioned commits; push/pull/merge with remotes | git repo volume (encrypted bundles) |
| L2 Data | `postgres:16` + storage volume | live application database; assets | data volume (OS-level encryption) |
| L1 Runtime | per-OS container engine | see matrix below | — |

**Layer contract rule:** L3 never talks to L5; L4 is the only layer allowed to
authorize a sync (regression gate); L2 is only ever touched by L3 and L4.
L4B is read-only toward L2 and is never in the sync path — a verdict engine
must not be able to alter the data it judges.

---

## 4. OS matrix (L1)

| OS | Container engine | Notes |
|---|---|---|
| **Windows 10/11** (primary dev) | Docker Desktop (WSL2 backend) | WSL2 runs a real Linux kernel; the stack behaves identically to Linux. Data volume sits on the WSL2 ext4 disk; enable BitLocker on the host for at-rest coverage. |
| **Windows (no Docker license tier)** | Podman Desktop or Rancher Desktop | drop-in Docker-compatible engines; same compose files |
| **macOS** | Docker Desktop or OrbStack | same stack; FileVault covers at-rest |
| **Linux desktop** | native Docker Engine | identical to the VPS target — dev/prod parity |
| **Linux VPS (server node)** | native Docker Engine | always-on node; the "origin" remote lives here |
| **Android** | Termux + Podman (Phase II) or browser-only | fallback: browser client in offline/local mode |
| **iOS** | browser-only (no containers permitted) | offline via localStorage fallback in `dataLayer.js` |

**Portability contract:** one `docker-compose.yml` + one `.env` template runs
unchanged on every row of this table. Nothing in the stack may require a
platform-specific flag.

---

## 5. The GitHub-like system: local · offline · online (L3)

### 5.1 Model

The sync engine uses **git itself** as the versioning substrate — it already
provides the GitHub-like properties (content-addressed commits, branching,
diff/merge, remotes, history) — but the payloads are **encrypted opaque
bundles**, so the remote stores ciphertext and learns nothing:

```
code repo (plaintext, standard git)          data repo (ciphertext bundles)
──────────────────────────────────           ─────────────────────────────────
app.js · dataLayer.js · index.html           snapshots/<ts>/db.sql.gz.age
templates · docs · tests                     snapshots/<ts>/assets-manifest.age
push/pull → GitHub (PRGMEDIA/…)              push/pull → private remote (Gitea
                                             container on the VPS, or any git remote)
```

- **Local:** commits are made continuously (autosave checkpoints → snapshot
  bundles). Works with no network; history is fully local.
- **Offline:** queue keeps committing locally; `git push` simply happens on
  the next session. Divergent history is merged (last-write-wins per record,
  conflicts surfaced in the session report).
- **Online:** push + pull over SSH/HTTPS. The remote never holds plaintext.

### 5.2 Snapshot format (L3 → L2 contract)

Every snapshot bundle contains:
1. `db.sql.gz` — logical dump of the member's data (pg_dump, filtered by
   `owner_id` where applicable)
2. `assets-manifest.json` — media metadata + per-file checksums
3. `media/<sha256>` — asset blobs (deduplicated by content hash)
4. `manifest.json` — schema version, app version, device id, timestamp,
   checksums of the above

Encryption: `age` (modern, tiny, keypair-based). Each device holds a private
key in the OS secret store (Windows Credential Manager / macOS Keychain /
libsecret; TPM-backed where available). Remotes and peers hold only public
keys. Result: any remote can *store* snapshots, only key holders can *read*.

### 5.3 Remotes

| Remote | Runs where | Purpose |
|---|---|---|
| `origin` | GitHub (existing repo) | code, docs, workflows |
| `data-origin` | Gitea container on the VPS (or any private git remote) | encrypted data bundles |
| `peer` | other devices | direct device-to-device pull (optional, Phase II) |

---

## 6. Encryption environment (all layers)

| Layer | Mechanism |
|---|---|
| Transit | HTTPS/TLS 1.3 (Caddy on the VPS); SSH for git transport |
| Data bundles at rest | `age` encryption (X25519) — ciphertext-only remotes |
| Database volume | OS-level disk encryption (BitLocker / FileVault / LUKS); on VPS, LUKS + encrypted backups |
| In-DB sensitive columns | pgcrypto where row-level encryption is warranted (client contact data) |
| Keys | device private keys in OS secret store; recovery key printed once and stored offline; key rotation = re-encrypt manifest + re-push (content-addressing makes this cheap) |
| Secrets (`DB_PASSWORD`, tokens) | `.env` per node, git-ignored; GitHub Actions secrets for CI |

**Threat model note:** this design protects against stolen remotes, stolen
disks, and passive network observers. It does not protect against a
compromised running device (the keys must be usable by the app) — stated
explicitly so expectations stay honest.

---

## 7. The connection-session protocol (L4 — the core automation)

Trigger: **every transition to internet connectivity** (`online` event in the
browser, `NetworkManager`/`netplan` dispatcher or Docker `healthcheck` on
Linux, scheduled fallback every 30 min). One "session" is one full cycle:

```
 ┌─ internet connection detected ────────────────────────────────┐
 │                                                               │
 │  STEP 1  INTEGRITY      verify data volume + last snapshot    │
 │                         checksums; verify git repo health     │
 │                                                               │
 │  STEP 2  REGRESSION     run test suite in a clean container:  │
 │                         tests/regression.js + schema checks   │
 │                         + dataLayer contract tests            │
 │                         → PASS required to continue          │
 │                         → FAIL: quarantine sync, alert, exit │
 │                                                               │
 │  STEP 3  SYNC           pull remote bundles → merge →         │
 │                         push local commits (encrypted)        │
 │                         (new PUSHES recorded)                 │
 │                                                               │
 │  STEP 4  REGULATIONS    fetch regulation delta from           │
 │                         Regulations.AI (OKF bundle diff or    │
 │                         MCP `recent_changes`), diff against   │
 │                         last-known corpus hash                │
 │                         (new REGULATIONS recorded)            │
 │                                                               │
 │  STEP 5  CROSS-REF      join the two: new commits ↔ new       │
 │                         regulation changes; write             │
 │                         session_log row + human report        │
 │                                                               │
 └───────────────────────────────────────────────────────────────┘
```

### 7.1 Regression suite contents

| Suite | Checks |
|---|---|
| `tests/regression.js` (existing) | editor/gallery/export behavior regressions |
| schema check | `001_init.sql` hash matches deployed schema version; RLS policies present |
| adapter contract | `dataLayer.js` CRUD round-trip against a scratch Postgres |
| bundle integrity | decrypt last snapshot, verify checksums, restore into scratch DB |
| encryption | age round-trip; key presence in OS store |

### 7.2 Regulation cross-reference

- `regulations` domain tables (mirrors Regulations.AI corpus shape:
  `instruments`, `jurisdictions`, `enforcement_actions`, `glossary_terms`,
  `corpus_state` storing last-seen hash per jurisdiction).
- Each session stores: corpus hash before → after, list of new/changed
  instruments, and the commit range that shipped in the same session.
- Report answers: *"Since my last connection, what did I push, and what did
  the world of AI regulation do?"* — plus tag-matching: projects tagged with
  jurisdictions/topics get flagged when a relevant regulation changes.
- Licence caution: Regulations.AI data is ingested for internal use;
  redistribution requires checking their `/enterprise` terms first.

### 7.3 Industry-specific regulatory box — L4B "VMSB Reg-Check"

A dedicated container (`aura-regcheck`) inside the same encrypted environment,
scoped to the node's industry profile. Its job: when a regulatory question or
claim arises (from Guardian's regulation deltas, from project tags, or on
demand), it produces a **cross-checked verdict** — never a single model's
word.

```
                       ┌─────────────────────────────┐
  regulatory question  │      aura-regcheck (L4B)    │
  or new regulation ──►│                             │
                       │ 1. REFRAME   turn question  │
                       │    into neutral, source-    │
                       │    seeking queries          │
                       │            │                │
                       │ 2. ENSEMBLE  ask N models   │
                       │    the SAME reframed query  │
                       │            │                │
                       │ 3. CITE      require each   │
                       │    answer to carry source   │
                       │    URLs (official journals, │
                       │    regulator pages)         │
                       │            │                │
                       │ 4. VERIFY   fetch cited     │
                       │    sources; check the claim │
                       │    actually appears there   │
                       │            │                │
                       │ 5. CONSENSUS score, classify, store
                       └──────────────┬──────────────┘
                                      ▼
                         verdict + citations → session_log / alert
```

#### Ensemble

| Checker | Role | Notes |
|---|---|---|
| **VMSB Reg AI (internal)** | the claim under test | first position in every lineup |
| **Gemini** | independent read | long-context: full statute text fits |
| **ChatGPT (OpenAI)** | independent read | strong general legal reasoning |
| **Grok (xAPI)** | independent read | real-time web grounding |
| **(slot 5+)** | add Claude / Perplexity / sector models | pluggable adapter list |

All external calls are **stateless and sanitized**: the box sends reframed
questions and public regulatory text only — never member data, client data,
or project contents. API keys live in `.env` per node, never in git.

#### Source hierarchy (what counts as authoritative)

1. **Primary law**: official journals & texts (EUR-Lex, Federal Register,
   gov.uk, state/national legislatures), the official source URL carried by
   every Regulations.AI record
2. **Regulator guidance**: enforcement agencies' own publications
3. **Standards bodies**: NIST AI RMF, ISO/IEC 42001, IEEE
4. **Trackers/corpi**: Regulations.AI corpus (used for *discovery*, never as
   final authority)
5. **Model opinion**: the LLMs themselves — always the *lowest* tier

#### Consensus scoring

Each verdict gets a machine-readable grade:

- **CONFIRMED** — all models agree AND every load-bearing claim verifies
  against a Tier 1–2 source → store with citations, no action needed
- **CORROBORATED** — majority agree, ≥1 Tier-1 citation → store, flag
  minority dissent in the report
- **DISPUTED** — models split with no verifying primary source → hold,
  surface in session report for human review
- **UNVERIFIABLE** — no source found → hold, never store as fact

Verdicts land in a `regcheck_verdicts` volume (age-encrypted like all data
volumes) and join the session's `crossref` block: a new regulation that
affects a tagged project can carry its verdict chain with it.

### 7.4 Session record (`session_log`)

| Column | Notes |
|---|---|
| `id`, `device_id`, `started_at`, `ended_at` | |
| `regression_result` | pass/fail + suite summary jsonb |
| `pushes` | commit range, files, bundle ids |
| `regulation_delta` | new/changed instruments jsonb, corpus hash |
| `crossref` | matched project/asset/client tags ↔ regulation topics |

---

## 8. Roadmap

| Phase | Deliverable | Status |
|---|---|---|
| C0 | This architecture document | ✅ this doc |
| C1 | `sync/docker-compose.yml` — full 5-layer stack for local dev | next |
| C2 | `aura-sync` v0: snapshot → age-encrypt → local git commits | next |
| C3 | `aura-guardian` v0: online-event trigger + regression gate + session_log | next |
| C4 | Regulations.AI ingestion (OKF bundle diff) + cross-reference report | next |
| C4.5 | `aura-regcheck` v0: ensemble cross-check (VMSB + Gemini + ChatGPT + Grok), citation verifier, consensus grader | next |
| C5 | Gitea `data-origin` on VPS + deploy workflow wiring (uses existing `deploy.yml`) | next |
| C6 | Peer-to-peer device sync; mobile postures | later |

---

## Appendix A — Reputable Source Registry

The authoritative source list loaded by `aura-regcheck` per industry profile.
Verified 2026-11-04. Tier ordering matches §7.3's hierarchy: a claim is only
as strong as the highest tier that verifies it.

### Tier 1 — Primary law & official journals (the only final authority)

| Source | URL | Covers |
|---|---|---|
| EUR-Lex (Official Journal of the EU) | eur-lex.europa.eu | EU law incl. AI Act authentic text |
| EU AI Act Explorer / Service Desk | ai-act-service-desk.ec.europa.eu | Official browsing of Reg (EU) 2024/1689, incl. the 2026 Digital Omnibus amendment (Reg 2026/1744) |
| Federal Register / govinfo (US) | federalregister.gov · govinfo.gov | US federal rules & laws |
| **US state legislatures (official sources)** | leg.colorado.gov · leginfo.legislature.ca.gov · capitol.texas.gov · ilga.gov · nysenate.gov · (+ per-profile states) | **US state law is primary law** — each state's official legislative site is Tier 1 for that state's acts. See state table below. |
| NYC Council (Legal) | council.nyc.gov | NYC Local Law 144 (AEDT bias audits) — municipal law of Tier-1 weight |
| legislation.gov.uk | legislation.gov.uk | UK statutes incl. UK AI policy instruments |
| UN / treaty texts | un.org · treaty bodies | international instruments |

#### US state AI law (verified 2026-11-04) — the patchwork the box must track

No comprehensive federal AI statute exists; obligations arrive **state by
state**, and statuses move (delay, litigation, repeal-and-replace). The box
tracks **effective dates and rulemaking**, not just enactment:

| State | Instrument | Status (Nov 2026) | Official source |
|---|---|---|---|
| **Colorado** | SB 26-189 (ADMT law; repeals & reenacts SB 24-205 — which **never took effect**: delayed to Jun 30 2026, then replaced May 14 2026) + HB 26-1263 (Chatbot Safety Act) | Applies **Jan 1, 2027**; AG rulemaking in progress; enforcement enjoined in *xAI v. Colorado* pending ruling | leg.colorado.gov · coag.gov/ai |
| **California** | SB 53 (Frontier AI Transparency Act) | **In force** since Jan 1, 2026 | leginfo.legislature.ca.gov |
| **California** | AB 853 (AI Transparency Act — delays SB 942 to Aug 2, 2026) | In force; SB 942 operative **Aug 2, 2026** | leginfo.legislature.ca.gov |
| **California** | CPPA ADMT regulations | Compliance by Jan 1, 2027 | cppa.ca.gov |
| **Texas** | TRAIGA (HB 149) | **In force** since Jan 1, 2026 (narrower: prohibited-uses focus) | capitol.texas.gov |
| **Illinois** | HB 3773 (AI in employment, IHRA) | **In force** since Jan 1, 2026 | ilga.gov |
| **New York** | Frontier-model safety act + AG/DFS oversight | Enacted; check current effective dates per session | nysenate.gov |
| **NYC** | Local Law 144 (automated employment decision tools) | **In force** since Jul 5, 2023 (bias audit, notice) | council.nyc.gov |
| **Tennessee** | ELVIS Act (voice/likeness protection) | In force — **directly relevant to creative/media industry** | capitol.tn.gov |

**State-tier rules:** (1) applicability is residency/activity-based — a
member in Illinois is covered by HB 3773 even if the server is in Texas;
(2) treat *effective date ≠ signed date ≠ enacted date* as three separate
tracked fields; (3) AG rulemaking pages (e.g. coag.gov/ai) are Tier 2
sources that can change obligations before the statute text does.

### Tier 2 — Regulators & enforcement bodies

| Source | Notes |
|---|---|
| European AI Office (EC) | enforces GPAI rules under the AI Act; publishes codes of practice |
| EDPB + national DPAs (CNIL, ICO,…) | data-protection enforcement touching AI |
| US: FTC, DOJ, state AGs | unfair/deceptive AI practices, enforcement actions |
| Sector regulators | FDA (health), SEC/FINRA (finance), FAA (transport) — loaded per industry profile |
| International Network of AI Safety Institutes (AISIs) | US NIST AISI, UK AISI, and counterparts — safety evaluations & guidance |

### Tier 3 — Standards bodies & frameworks

| Source | Notes |
|---|---|
| NIST AI RMF + AIRC (airc.nist.gov) | AI RMF 1.0 (NIST AI 100-1); **under active revision in 2026** + new Critical Infrastructure profile — version-pin and re-verify each session |
| ISO/IEC 42001 (AI management), ISO/IEC 23894 (AI risk) | certifiable management standards |
| IEEE 7000 series | ethics-aligned engineering standards |
| C2PA | content provenance/authenticity — **directly relevant to creative/media industry** (signed media, AI-disclosure metadata) |
| OECD AI Principles & AI Policy Observatory (oecd.ai) | government-adopted principles + live policy database |
| Council of Europe Framework Convention on AI | first binding international AI treaty |

### Tier 4 — Research & trackers (discovery only, never final authority)

| Source | Notes |
|---|---|
| Regulations.AI corpus | discovery layer for this system (§7.2); carries official source URLs per record |
| Stanford HAI / AI Index | annual empirical measurement, model/policy trends |
| University & civil-society institutes | use for leads; always trace back to Tier 1–3 |

### Tier 5 — Model ensemble (opinion, lowest tier)

| Provider | API | Ensemble role | Notes |
|---|---|---|---|
| VMSB Reg AI (internal) | internal | claim under test | first in every lineup |
| Google Gemini | Google AI API | long-context statute analysis | |
| OpenAI ChatGPT | OpenAI API | general legal reasoning | |
| xAI Grok | x.ai API | real-time web grounding | |
| Anthropic Claude | Anthropic API | careful constitutional-style analysis | recommended 5th slot |
| Mistral | Mistral API | EU-domiciled provider | useful for EU data-residency postures |

**Model-tier rules:** (1) never cite a model as authority — models locate and
interpret, only Tier 1–2 verifies; (2) keep provider list pluggable — any
model may be added/removed without touching the consensus engine; (3) log
model + version + date with every answer (model outputs drift with updates).

## 9. Open questions

1. Default remote for data bundles: self-hosted Gitea on the VPS vs a private
   GitHub repo (GitHub stores ciphertext, so privacy holds either way)?
2. Snapshot cadence while offline: time-based (hourly) vs event-based (per
   meaningful change)?
3. Key recovery policy: single recovery key vs Shamir split (2-of-3)?
4. Regulations.AI ingestion cadence: every session vs daily cron on the VPS?
5. VMSB Reg AI: what is the internal regulatory engine's exact interface (API endpoint? local model? prompt pipeline)? Needed before the ensemble adapter can be written.
6. Industry profile(s) in scope first (e.g., media/creative, healthcare, finance)? Determines the jurisdiction list and regulator set the box loads.
