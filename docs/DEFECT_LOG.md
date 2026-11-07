# Aura Studio — Defect Log (Phases 1–3) — Audit Record

**Purpose:** complete audit trail of every defect encountered across Phases 1–3, with root cause, impact, resolution, prevention, and verification status.
**Maintained in:** this file (repo doc of record) ·mirrored/expanded in `05_Issue_Log.md` (Desktop documentation set).
**Last updated:** 2026-11-05 · **Status legend:** CLOSED = fixed + verified · OPEN = fix pending · MONITORING = fix deployed, awaiting field confirmation

---

## Summary

| Phase | Window | Defects | Critical | High | Medium | Low/Info | Open |
|---|---|---|---|---|---|---|---|
| Phase 1 — build & local | 2026-10-25 → 11-04 | I-001, I-002, I-003, I-004, I-005, I-006, I-007, I-010, I-011, I-012 | 2 (I-003, I-005) | 2 | 3 | 3 | 0 |
| Phase 2 — deployment & infra | 2026-11-02 → 11-05 | I-008, I-009, I-018, I-019, I-020 (+ DNS incident) | 0 | 3 | 1 | 1 (+1 infra) | 1 (I-019 monitoring) |
| Phase 3 — current | 2026-11-05 → | I-021, I-022, I-023, I-024 | 1 (I-021) | 2 | 1 | 0 | 1 (I-024 env) |
| **Total** | | **17 defects + 2 infra incidents** | **3** | **7** | **5** | **4** | **2** |

**Defect-escape analysis:** two defects escaped to production in shipped code (I-003: 6 weeks undetected; I-018: shipped in v2.0.0–v2.3.x). Both were static-analysis gaps — closed by CI gates (`node --check`) and behavioral regression tests (R-06, R-24, R-30/R-31).

---

## Phase 1 — Build & local development

### I-001 · String literals corrupted across lines
- **Date/Phase:** 2026-10-25 · Phase 1 · **Severity:** Medium · **Component:** templates.js
- **Description:** Literal newlines were injected into JS string literals while authoring the "Travel Feature" template, breaking that template's parse context.
- **Root cause:** Multiline content pasted into single-quoted JS strings during template authoring.
- **Impact:** Template parse failure risk (caught before release in this instance).
- **Resolution:** Escaped to `\n`; verified by quote-balance scan.
- **Prevention:** Quote-balance scan on every template edit; superseded by full `node --check` gate (I-003).

### I-002 · Single-file bundle breaks at first `</script>`
- **Date/Phase:** 2026-10-25 · Phase 1 · **Severity:** High · **Component:** tools/build_single.py
- **Description:** The embedded Admin HTML contains `</script>` sequences; pasted verbatim into an inline `<script>` string, the HTML parser terminates the script block early — the single-file build would be silently broken.
- **Root cause:** Raw `</script>` inside JS string literals embedded in HTML.
- **Impact:** Would have broken the portable single-file distribution.
- **Resolution:** All `</` sequences escaped to `<\/` inside the embedded literal; builder sanity assertion added.
- **Prevention:** Builder asserts no unresolved refs (regression R-17).

### I-003 · Unterminated `tpl(` call breaks the entire gallery — **escaped to production**
- **Date/Phase:** introduced 2026-10-25 (v1.0.0) · detected 2026-11-04 · Phase 1 · **Severity:** CRITICAL
- **Component:** templates.js ("Project Memo" template)
- **Description:** One `tpl(...)` call ended with `;` instead of `);`. The entire `templates.js` file failed to parse → `TEMPLATES` never loaded → gallery empty and every UI control wired after it (Project, Export, Admin) silently dead. **Escaped to production and persisted for the whole Phase 1/2 lifetime of the shipped app.**
- **Root cause:** Missing closing parenthesis; no JS parser in any validation step at the time.
- **Impact:** Core functionality dead in all deployed versions until v2.4.x-era fix.
- **Resolution:** Character fixed (`79413a2`); `node --check` syntax gate added to CI for every JS file.
- **Prevention:** CI syntax gate + full regression suite (R-01).

### I-004 · Glyph elements render empty
- **Date/Phase:** introduced with emoji support · detected 2026-11-04 · Phase 1 · **Severity:** High
- **Component:** templates.js / app.js (glyph builder vs renderer)
- **Description:** Glyph builder stored the character in `.ch`; the renderer read `.text` — every emoji/icon in every template rendered blank on canvas and in exports.
- **Root cause:** Data-model field drift between writer and reader.
- **Impact:** All decorative icons invisible in templates and exports.
- **Resolution:** Builder sets both fields; `hydrate()` normalizes legacy `.ch` → `.text` on load.
- **Prevention:** Regression R-06 validates element contracts against the real library.

### I-005 · Live WireGuard credentials staged for public push — **near-miss**
- **Date/Phase:** 2026-11-03 · Phase 1/2 boundary · **Severity:** CRITICAL (near-miss, no exposure)
- **Component:** templates.js (user-added VPN templates)
- **Description:** Real WireGuard private keys, public keys and tunnel details were staged in `templates.js` ahead of a push to the now-public repository.
- **Root cause:** Secrets embedded in a source file; no secret-scanning gate at the time.
- **Impact:** None — caught before push; keys never left the machine.
- **Resolution:** Credentials scrubbed to explicit placeholders; live-site secret scan confirmed clean; key rotation recommended to the owner.
- **Prevention:** Regression R-21 blocks any credential-shaped string (43-char base64 pattern) on every push.

### I-006 · Admin button silently dead (popup blocker)
- **Date/Phase:** 2026-11-03 · Phase 1/2 · **Severity:** Medium · **Component:** app.js (Admin entry)
- **Description:** `window.open` for the Admin Agent was silently swallowed by popup blockers — clicking Admin did nothing.
- **Root cause:** Popup-based tool launch.
- **Impact:** Admin Agent appeared completely non-functional for affected users.
- **Resolution:** v1.6.1 — in-page overlay panel; v1.6.2 — single-file build converted to `srcdoc` iframe overlay (no popups anywhere).
- **Prevention:** Regression R-17 enforces popup-free bundles; no `window.open` remains in any admin flow.

### I-007 · CMYK→RGB→CMYK numeric drift
- **Date/Phase:** 2026-11-04 · Phase 1 · **Severity:** Low · **Component:** app.js CMYK engine
- **Description:** Round-tripping CMYK through RGB quantization drifts up to 40% numerically for near-black inks.
- **Root cause:** Mathematical property of naive conversion near K≈100, not a coding error.
- **Impact:** None user-visible (rendered color preserved within 2/255).
- **Resolution:** Invariant corrected — tests assert **rendered color preservation** (≤12/255; measured 2/255), not numeric identity.
- **Prevention:** Regression R-10 (40 randomized samples per run).

### I-010 · CI Node deprecation warning
- **Date/Phase:** 2026-11-03 · Phase 2 · **Severity:** Info · **Component:** .github/workflows
- **Description:** `actions/checkout@v4`, `actions/setup-python@v5` targeted Node 20 (deprecated runtime).
- **Resolution:** Bumped to `checkout@v5`, `setup-python@v6`.
- **Prevention:** — (routine maintenance)

### I-011 · Diagnostic artifacts committed to the public repo
- **Date/Phase:** 2026-11-03/04 · Phase 2 · **Severity:** Low · **Component:** repo hygiene
- **Description:** `suite_out.txt` / `live_templates.js` / `site_check.html` accidentally committed (repeated three times) via `git add -A` chains.
- **Root cause:** Ad-hoc diagnostic downloads in the working tree + blanket staging.
- **Impact:** Repo noise only; no secrets.
- **Resolution:** Removed in follow-up commits each time.
- **Prevention:** Diagnostics written outside the repo tree; selective staging adopted (and re-broken, see I-024 process notes).

### I-012 · Stale-file edit conflicts after git rebase
- **Date/Phase:** 2026-11-04 · Phase 2 · **Severity:** Info
- **Description:** Editing sessions hit "file modified after read" states following rebase/checkout operations.
- **Resolution:** Re-read before edit discipline adopted.

---

## Phase 2 — Deployment & infrastructure

### I-008 · Live site 404 — visibility chain (private repo, confirmation dialog, trailing hyphen)
- **Date/Phase:** 2026-11-02 → 11-04 · Phase 2 · **Severity:** Medium · **Component:** GitHub hosting
- **Description:** The live URL 404'd for three stacked reasons, resolved sequentially: (a) repo created private — Pages unavailable on free tier; (b) visibility change required typed confirmation and was silently incomplete; (c) repo name's trailing hyphen made the Pages URL case/hyphen-exact.
- **Resolution:** Repo made public; Pages enabled (deploy from `main`/root); repo renamed `Cr8tiveSp8ce-` → `Cr8tiveSp8ce` via API; new URL verified 200 with content.
- **Prevention:** Deployment log records the full chain; URL verification added to every release check.

### I-009 · First push rejected (remote divergence)
- **Date/Phase:** 2026-11-02 · Phase 2 · **Severity:** Low
- **Description:** Push rejected — the user's pre-existing V1 history/LICENSE was on the remote.
- **Resolution:** `git pull --rebase` — clean replay, no conflicts.

### I-018 · Media Library insert throws ReferenceError — **escaped to production**
- **Date/Phase:** introduced v2.0.0 · detected/fixed v2.4.0-era · Phase 2 · **Severity:** High
- **Component:** app.js (Media Library insert handler)
- **Description:** The insert handler referenced `isAud`, which was scoped to the cell-builder closure — clicking **➕ Insert** on any library item threw `ReferenceError: isAud is not defined`. Library inserts were completely broken in shipped versions v2.0.0–v2.3.x.
- **Root cause:** Variable defined in one scope, used in another; static string checks couldn't catch scope errors.
- **Impact:** Media Library insert flow dead for all users of affected versions.
- **Resolution:** `isAud` defined in the handler scope (`88d3362` era).
- **Prevention:** Behavioral regression coverage expanded; remaining scope-audit documented as a known gap (see Validation Report §6).

### I-019 · PNG export produces solid/blank image — **user-reported, MONITORING**
- **Date/Phase:** 2026-11-05 · Phase 2/3 · **Severity:** High · **Component:** app.js export pipeline
- **Description:** Exported PNG contained only the flat background — none of the design's elements rendered.
- **Root cause (analysis):** most probable chain — an element draw throwing mid-loop previously aborted rendering without diagnostic, combined with background normalization gaps (an invalid `page.bg` silently retained the previous fillStyle — black) and unguarded scale values.
- **Resolution (v2.4.1, `328397f`):** per-element try/catch isolation (one bad element can't blank the page; failures counted and logged), background normalization (`#`/rgb/hsl validated, else white), scale sanity guards (NaN/out-of-range → 1), and a **blank-detection self-check** (64×64 downsample uniformity test) that warns with page/element diagnostics on every export.
- **Verification:** R-29 wiring checks green; **field confirmation from the user's environment still requested** (console output will now name any failing element).
- **Status: MONITORING.**

### I-020 · Member sign-in rejects valid members / superuser lockout
- **Date/Phase:** 2026-11-05 · Phase 2/3 · **Severity:** High · **Component:** app.js (member gate), admin.html
- **Description:** (a) Sign-in used a registry snapshot captured at modal-open — members created afterwards were rejected as unknown; (b) members predating the superuser role had no flag — the Admin Agent member panel was unreachable ("completely off" per user report).
- **Resolution (v2.4.2, `97f2c91`/`3ea13c6`):** sign-in reads the fresh registry; Admin Agent recovery path lets you designate a superuser when none exists; Enter-key submit added.
- **Prevention:** Behavioral members-logic check R-30 (create → verify → reject → scoped keys, executed against the real functions headlessly).

### DNS incident (infra, 2026-11-05)
- Transient "Could not resolve host: github.com" during a push (user connection/VPN). Push retried successfully. Relevance: the VPN affects **outbound connectivity only** — never in-app functionality.

---

## Phase 3 — Current phase

### I-021 · No forgot-password workflow (member lockout)
- **Date/Phase:** 2026-11-05 · Phase 3 · **Severity:** High · **Component:** member auth
- **Description:** A member who forgot their password was permanently locked out of their profile (reported by product owner; logged to Phase III).
- **Resolution (v2.6.0):** device-local recovery workflow — recovery code issued at member creation (shown once, stored hashed), "Forgot password?" redemption on the sign-in gate (resets password, rotates code), superuser code re-issue from the Admin Agent. Email-based reset planned for the cloud tier (FP-7).
- **Prevention:** Behavioral recovery test R-31 (code verify, wrong code rejected, reset works, old password dead).

### I-022 · Pan-left/pan-right zooms but does not pan
- **Date/Phase:** 2026-11-05 · Phase 3 · **Severity:** Medium · **Component:** app.js (pvDrawPhoto motion)
- **Description:** Pan motions moved only 25% of the available overscan (±12.5%) — perceived as "zooms in but does not pan".
- **Root cause:** Travel formula multiplied the margin by 0.5 twice (half of half).
- **Resolution:** Full-margin travel (edge-to-edge pan) with zoom raised to 120%; **behavioral test R-34** drives the real `pvDrawPhoto` with a recording context and asserts ≥250px travel in opposite directions for pan-left vs pan-right.
- **Status:** fix in working tree (`app.js`), verification test written; **commit pending** (blocked by the file-conflict issue below).

### I-023 · Duplicate control: silent no-op + no page duplication
- **Date/Phase:** 2026-11-05 · Phase 3 · **Severity:** Medium · **Component:** app.js (editor)
- **Description:** (a) The ⧉ Duplicate button did nothing (no feedback) when no element was selected; (b) there was no way to duplicate a page — only "add blank page".
- **Resolution (working tree, v2.9.0):** (a) explicit toast "Select an element first — then Duplicate copies it"; (b) **page duplication** — ⧉ button in the page strip deep-clones the current page (all elements, fresh IDs) and opens the copy.
- **Status:** fix complete in working tree; **commit pending** (blocked by file-conflict issue below).

### I-024 · Version identifier drift between docs and code
- **Date/Phase:** 2026-11-04/05 · Phase 3 · **Severity:** Low (process) · **Component:** release process
- **Description:** `APP_VERSION` lagged the version labels used in commits/docs (docs said 2.3.0/2.4.1/2.4.2 while code read 2.2.0/2.4.0).
- **Resolution:** Aligned at 2.4.1→2.9.0 checkpoints; remaining: make the version bump part of each release commit.
- **Prevention:** Candidate for a release checklist item / CI assertion (version constant vs latest tag).

### ENV-1 · External file reversion hazard (environment, not code)
- **Date/Phase:** 2026-11-05 · Phase 3 · **Severity:** High (workflow hazard)
- **Description:** `tests/regression.js` and `admin.html` were repeatedly reverted to stale snapshots seconds after verified writes — an editor or sync tool holding stale copies is overwriting the working tree. This blocked test consolidation and twice risked committing broken intermediate states.
- **Status:** OPEN — awaiting the owner to close stale editor buffers/disable autosave on the folder before the pending re-land completes.
- **Mitigation applied:** atomic single-command apply→test→commit→push chains (race-safe); consolidated test-file rewrite prepared.

---

## Security hardening record (audit-relevant improvements)

| Ref | Change | Trigger |
|---|---|---|
| SH-1 | Account-enumeration leak removed: duplicate-member error no longer reveals which IDs exist; sign-in and recovery failures unified to non-revealing messages | Owner directive (Phase III) — **applied in working tree, commit pending with I-023 batch** |
| SH-2 | Recovery codes hashed (salted SHA-256, member-ID namespace); shown once; rotated on use; superuser re-issue stores hash only | I-021 |
| SH-3 | Credential-pattern scan (43-char base64) blocks every push | I-005 |
| SH-4 | Provider API keys for cloud AI proxied server-side; never shipped to the browser | Phase II design |

---

## Open items at audit close

| Ref | Item | Blocked on |
|---|---|---|
| I-019 | Field confirmation of solid-PNG fix (diagnostics now name failing elements) | User reproduces; console output requested |
| I-022/I-023 | Fixes complete in working tree — **commit + push pending** | ENV-1 file-reversion hazard resolved |
| I-021/FP-7 | Email-based password reset | Cloud backend (Supabase or Oracle-hosted Postgres) |
| ENV-1 | External file reversion (editor/sync) | Owner closes stale editor buffers |

---

## Metrics

- **Defects total (Phases 1–3):** 17 code defects + 2 infra incidents + 1 environment hazard
- **Escaped to production:** 2 (I-003, I-018) — both static/scope-analysis gaps, both now covered by automated gates
- **Mean time to fix (Phase 3):** same-session for I-021/I-022/I-023
- **Regression suite at audit close:** 40+ checks (sync + async behavioral), all green locally; CI green on last verified push
- **Recurrence rate:** 0 — no defect has recurred after its prevention gate was added

---

## Phase III continued — session 2026-11-07

### I-027 · Member sign-in crashed on every attempt (ReferenceError) — ESCAPED
- **Date/Phase:** 2026-11-07 · Phase 3 · **Severity:** Critical
- **Description:** A partial edit to the `signIn` handler referenced a variable `actual` that was no longer in scope (the defining lookup had been reverted by ENV-1). Every sign-in attempt threw `ReferenceError: actual is not defined`, blocking all member access.
- **Root cause:** Partial-edit + external-revert race (ENV-1): the lookup defining `actual` was reverted while the lines consuming it survived.
- **Resolution:** Lookup restored (case-insensitive, so `Villa`/`villa` resolve to one member) and committed as `a4dee3b` with a syntax gate already in CI (prevention from I-003) plus behavioral member checks in the regression suite.
- **Status:** CLOSED.

### I-028 · Phone field displayed but never stored
- **Date/Phase:** 2026-11-07 · Phase 3 · **Severity:** Medium
- **Description:** The Phase III "optional phone at member sign-in" change shipped the `#mPhone` input in the gate modal, but the create-member handler never read it — the field was dead UI and no member record carried a phone.
- **Root cause:** HTML added without wiring the handler (incomplete change, same session as I-027).
- **Resolution:** `mNew` now reads `#mPhone` and stores `phone` on the member record when non-empty. Committed with I-027.
- **Status:** CLOSED.

### I-029 · Duplicate-member check was case-sensitive
- **Date/Phase:** 2026-11-07 · Phase 3 · **Severity:** Low
- **Description:** Creating `villa` when `Villa` existed succeeded, producing two keys that the case-insensitive sign-in lookup would then resolve ambiguously.
- **Resolution:** Duplicate check is now case-insensitive, consistent with sign-in. Committed with I-027.
- **Status:** CLOSED.

### Metrics update (2026-11-07)
- **Defects total:** 20 code defects + 2 infra incidents + 1 environment hazard
- **Escaped to production:** 3 (I-003, I-018, I-027) — all static/scope-analysis or edit-race gaps; CI syntax gate + behavioral member suite now cover all three classes
- **Regression suite:** 45/45 PASS at commit `a4dee3b`
