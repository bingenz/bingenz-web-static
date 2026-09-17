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

## 2026-09-17 — inactive product drafts
- Decision: new admin-created products start inactive with no version or thumbnail, defaulting to 10,000 VND and 900 seconds. Creation and audit occur in one D1 batch; slug uniqueness is enforced by SQL.
- Reason: an incomplete simulation must never become purchasable before a privately uploaded, tested version and deliberate activation. Product creation is separated from the riskier HTML/thumbnail ingestion path.
- Alternatives: one-step public creation rejected because it could expose a product with no working paid asset.
- Consequences: drafts are absent from the public catalog. Admin upload/activation remains required; no remote data was changed. A concurrent duplicate slug still resolves safely to the SQL unique constraint, but its user-facing error needs refinement.
- Affected: src/admin.mjs, public/admin.html, public/admin.mjs, tests/worker.test.mjs.

## 2026-09-17 — bounded bulk metadata edits
- Decision: allow 1–25 selected products to update a validated shared metadata field, recording one audit row per successful optimistic D1 update. A versionless draft is skipped when activating. Report updated and skipped IDs rather than claiming the whole selection succeeded.
- Reason: maintain clear per-product outcomes under concurrent admin edits and prevent a draft without paid content from becoming purchasable.
- Alternatives: blanket update without per-product audit or version guard rejected. HTML mass replacement is not part of metadata bulk edit.
- Consequences: conflicting rows may be skipped while others succeed. Tests verify audit count, duplicate selection denial and inactive draft guard. Admin HTML upload needs a separate safe transform path; installed html-minifier-terser cannot browser-platform bundle because of Node built-ins.
- Affected: src/admin.mjs, public/admin.html, public/admin.mjs, tests/worker.test.mjs.

## 2026-09-17 — prepared private HTML upload and current-thumbnail route
- Decision: keep Node-only html-minifier-terser in a local preparation CLI and require an admin-upload package containing original and conservatively minified delivery bytes. Authenticated Worker verifies hashes/size, writes content-addressed private R2 objects first, then stores the version pointer and audit in a D1 batch. WebP replacements use a separate bounded binary upload; only the current D1-selected thumbnail is served publicly through the Worker.
- Reason: the existing minifier cannot bundle for browser-platform Workers because it imports Node built-ins. This preserves the same tested transformation without putting paid HTML under public assets or silently skipping minification. Thumbnail images are intentionally public, unlike simulation source.
- Alternatives: unminified direct HTML upload and public R2 object URLs rejected. A full runtime minifier rewrite is deferred.
- Consequences: seller runs `npm run prepare:admin-upload -- <trusted.html>` locally before selecting the private JSON package. A failed D1 write can leave harmless content-addressed orphan R2 objects; retry is safe. Server checks integrity, not that uploaded delivery is semantically identical to original; exact admin identity is the trust boundary. Drafts remain inactive. No remote upload performed.
- Affected: scripts/prepare-admin-upload.mjs, package.json, src/admin.mjs, src/worker.mjs, public/admin.*, README.md, tests/worker.test.mjs; private local `.private/admin-upload` artifact ignored.

## 2026-09-17 — admin order detail without credentials
- Decision: expose a signed-Access-gated order detail view with item snapshots, entitlement state/timestamps, payments, support notes and manual refund records. Search supports Gmail, order ID, BGZ code, SePay reference/ID, date and product. Exclude checkout/access/device hashes and raw tokens.
- Reason: seller operations need a consolidated evidence view before manual reconciliation or lost-link recovery is safe.
- Consequences: read-only detail is implemented; related mutations are still pending. No remote change.
- Affected: src/admin.mjs, public/admin.html, public/admin.mjs, tests/worker.test.mjs.

## 2026-09-17 — verified support recovery
- Decision: require an internal verification note and explicit customer-verified confirmation before a paid order's access link can be reissued. Rotate its stored access hash and session generation in one optimistic D1 batch with audit and support note; clear the device hash only when the seller selects reset. Return the new raw link once, without persisting it.
- Reason: lost-link and lost-device support must invalidate earlier credentials and preserve a traceable reason without revealing raw tokens in the admin detail view.
- Consequences: earlier links and sessions stop working immediately. Retaining device binding requires the original device; resetting it permits a new device. Verification is an operator attestation, not an automated identity check. No email is sent and no remote state changed.
- Affected: src/admin.mjs, public/admin.html, public/admin.mjs, public/admin.css, tests/worker.test.mjs.

## 2026-09-17 — guarded manual payment reconciliation
- Decision: list SePay payments requiring review and allow an authenticated admin to reconcile a payment to a pending order only when the stored webhook was inbound, sent to the expected account, and at least covers the order total. Require a review note and explicit acknowledgments for overpayment or a different/missing BGZ code. Fulfillment, payment status/linkage and audit are one D1 batch.
- Reason: late and unmatched payments need a deliberate seller path, but underpayments, wrong-bank and outgoing records must not become a payment bypass. The existing paid-order trigger continues to create the entitlement snapshot.
- Consequences: an operator can manually fulfill a late, overpaid or code-mismatched transaction after external verification. This is a high-trust admin action; it is not automatic proof from the bank statement. Underpaid payments remain for review. D1 `meta.changes` includes trigger work, so success uses the returned updated order row. No remote transactions were altered.
- Affected: src/admin.mjs, public/admin.html, public/admin.mjs, tests/worker.test.mjs.
