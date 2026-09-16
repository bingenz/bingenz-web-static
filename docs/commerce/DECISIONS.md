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
