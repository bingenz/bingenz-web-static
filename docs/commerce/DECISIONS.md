# Implementation decisions

## 2026-09-16 — authoritative specification and continuity
- Decision: preserve supplied document verbatim in IMPLEMENTATION_SPEC.md before implementation.
- Reason: explicit owner instruction and Section 41 context-loss recovery.
- Alternatives: conversation-only memory rejected.
- Consequence: all future sessions must read this specification and state files before edits.
- Affected files: docs/commerce/*.

## 2026-09-16 — recover Git history without overwriting extracted source
- Decision: recover metadata from official remote master, compare existing files, then create codex/commerce-storefront.
- Reason: current folder contains no .git; remote master is accessible.
- Consequence: preserve every existing file and document differences before implementation. Do not infer live production commit from remote master.
- Affected resources: local Git metadata and official GitHub remote.

## 2026-09-16 — corrected live simulation path
- Decision: use C:/Users/Acer/Downloads/QuickShare_2609122051, containing 35 current HTML files.
- Reason: specified nested QuickShare/_2609122051 path does not exist; live directory differs only in separator placement.
- Alternatives: older ZIP rejected; no archive used.
- Consequence: importer must accept an explicit source path; preserve originals outside public/ and Git.
- Affected resources: local simulation audit/import source.

## 2026-09-16 — R2 activation needs owner action
- Decision: stop before Add R2 subscription to my account; preserve browser tab for owner.
- Reason: R2 overview redirects to a subscription page with automatically renewing usage billing and explicit legal acceptance. Browser confirmation policy requires action-time confirmation for accepting terms.
- Alternatives: unauthorized subscription acceptance rejected; public simulation hosting rejected by specification. No alternative architecture substituted.
- Consequences: private R2 provisioning and mandatory infrastructure audit cannot finish until owner activates R2. No deployment or provider configuration changed.
- Affected resource: existing Cloudflare account R2 subscription; PROGRESS.md stores resume protocol.

## 2026-09-16 — inventory is evidence, not a completed simulation audit
- Decision: record per-file SHA-256, titles, inline script syntax checks and compatibility signals without checking paid source into Git.
- Reason: ensure no simulation is silently skipped, preserve privacy, and distinguish syntax validity from behavior.
- Consequences: all 35 require complete source/behavior review, thumbnail generation and wrapper smoke tests. API-name regex signals can include false positives (e.g. fetch in explanatory text).
- Affected files: scripts/audit-simulations.mjs, SIMULATION_INVENTORY.json, TEST_MATRIX.md.

## 2026-09-16 — SQL atomicity
- Decision: D1 triggers validate and snapshot carts atomically and fulfill a paid transition once; unique transaction and order-item constraints enforce idempotency.
- Reason: avoid multi-request race windows across Worker isolates.
- Consequences: migration tests cover constraints in SQLite; workerd/D1 integration remains required.
- Affected files: migrations/0001_commerce.sql, tests/schema.test.mjs.


## 2026-09-17 — resumed infrastructure and local-only foundation
- Decision: preserve newer live deployment ac96a0ba and leave production wrangler.toml untouched while implementing against wrangler.local.toml.
- Reason: live deployment changed outside recorded task work; Git association is unknown. Authenticated Chrome/SePay surface is currently unavailable.
- Consequence: provider configuration requires restored session later; local development/tests continue safely. No remote changes made.
- Foundation: checkout ownership uses a separate opaque HttpOnly cookie; Gmail aliases never authorize a claim. Rate limiting precedes external Turnstile validation; hostname and action are checked.
- Tooling: pinned Miniflare 5 alpha matches installed Wrangler dependency; use its exported convertV4MiniflareOptions compatibility adapter. Real local D1 tests pass. No production test bypass.

## 2026-09-17 — repeatable private import and safe transforms
- Decision: content-address original/delivery objects separately; deterministic product IDs derive from relative source paths, versions from original hash. Preserve seller metadata. product_imports tracks last source version so reruns preserve admin rollback and recover partial writes; changed source selects a new version without deleting history.
- Reason: interruption-safe, idempotent import without public paid source. Minify only local JS identifiers because script tags share global names.
- Consequences: unsupported external dependencies require explicit review. Prepared HTML stays under ignored .private; only WebP screenshots and hash metadata enter Git. Local R2 puts complete before D1 pointers are published. Remote import requires explicit config and bucket.
- Wrangler migration splitter requires whitespace before CASE; fixed before remote deployment, verified by real CLI migration and test using the same splitter.

## 2026-09-17 — customer access and isolated runtime
- Decision: access/device cookies use SameSite=Lax for saved-link navigation; all customer mutations require exact Origin. First claim binds the random device cookie (checkout secret fallback permits retry after a lost claim response). Only the access hash persists; retries restore the same bound-device session without redisplaying the raw link.
- Reason: avoid Strict cookies incorrectly rejecting a saved link opened from another site, while retaining CSRF protection and one-device binding.
- Consequences: lost raw link still requires manual admin support; generation changes invalidate sessions and permits. Runtime permit expires within60 seconds, and every delivery rechecks D1. Sandbox allows scripts only; CSP denies network/forms/privileged origin, with no-store and markers. Browser heartbeat locks runtime on failed authorization.
- Limitation: client-delivered code cannot be perfectly secret or remotely erased; documented source secrecy boundary remains.

## 2026-09-17 — owner-requested handoff and corrected provider state
- Decision: stop implementation, consolidate continuity records, validate existing work and create a documentation-only checkpoint. No implementation after commit.
- Reason: explicit owner instruction; earlier chronological progress appendices contained stale current-state claims.
- Correction: in-app browser is authenticated to SePay. Absence of Chrome is not a login blocker. Existing enabled BinGenZ payment webhook #56829 uses HMAC, incoming JSON, selected TPBank account, retries and payment verification. No provider mutation by this task.
- Incompatibility: saved provider URL uses /api/webhook/sepay; source router uses /api/webhooks/sepay. Reconcile the canonical endpoint with regression coverage on the next authorized continuation before provider tests/deployment. Do not claim integration readiness.
- BGZ recognition/filter and secret matching remain unverified. Error alerts are off. Existing Cube Jump webhook must remain intact. No banking credentials or secrets copied to state files.
- Cloudflare read-only refresh: remote R2 empty, only two unrelated D1 databases, live version ac96a0ba unchanged. Local D1/R2 imports are complete; remote commerce resources created by task remain zero.
- Affected: four continuity files only; no implementation/provider changes. Last implementation commit c386d07; handoff commit contains this entry. No outstanding owner action; pause is intentional, not a technical blocker.

## 2026-09-17 — resumed canonical webhook and admin foundation
- Decision: match the existing saved SePay #56829 singular `/api/webhook/sepay` URL in source; keep the unused plural route closed. No dashboard change or deployment.
- Reason: minimize provider mutation while fixing an independently verified integration mismatch. Official SePay HMAC documentation confirms the timestamp/raw-body signing format already used in source.
- Decision: serve `/admin` only after signed Cloudflare Access JWT validation, with exact Origin on mutations; implement read-only dashboard/order/product APIs and audited basic product edits as a first slice. The raw `admin.html` asset path is blocked.
- Reason: incremental admin operations need a fail-closed security boundary and real workerd/D1/browser tests before adding higher-risk reconciliation and recovery actions. Cloudflare's Access JWT guidance confirms issuer/audience/signature validation.
- Consequences: admin is still incomplete, outer Access policy not configured, no remote resources changed. No local admin bypass. A product edit and its audit insert execute in one D1 batch; concurrent seller-edit conflict handling remains to be designed.
- Affected: src/worker.mjs, src/admin.mjs, public/admin.*, tests/worker.test.mjs; local code only.
- Follow-on: version history API exposes only version metadata, not private R2 keys; rollback changes only the current version pointer and audits the previous/selected IDs in one D1 batch. Historical order_items keep their purchased version. No object is deleted. Tested with a second version and cross-product rejection.
