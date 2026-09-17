# Commerce implementation progress

Last updated: 2026-09-17T11:45:59Z (18:45 Asia/Saigon).

## Handoff
Owner resumed implementation after the previous documentation-only handoff. Work is active on the admin milestone; production remains untouched.

- Branch: codex/commerce-storefront. Started this resume clean at 37f6ff3.
- Last completed implementation checkpoint: 8ae9c4f (private HTML/thumbnail uploads); prior: 0c4c15d (bulk metadata editing), 249f0fa (inactive product drafts).
- Latest implementation checkpoints: 5ea335b (manual payment reconciliation), e48afdc (support recovery), ecaa46a (order detail).
- Production source baseline: origin/master 1a69783e5143e39fecae0bdd11089a078f2a1891.
- Live deployment freshly rechecked: ac96a0ba-d62e-4d86-9131-f1b4e4a3e981 at 100%, created 2026-09-16T15:31:43Z. Its Git SHA is unknown. Do not assume it matches the baseline.
- No task commits pushed/merged; no production deployment by this task.

## Completed
- Full specification persisted; repository and all 35 live originals audited. Source: C:/Users/Acer/Downloads/QuickShare_2609122051. Originally specified nested path is absent.
- ES-module Worker foundation; server-priced catalog/orders; Gmail validation/canonical abuse keys; rate limiting; pending reuse with independent checkout cookie; server Turnstile action/hostname checks; status and QR proxy.
- SePay raw-body HMAC/timestamp verification, idempotent transactions and SQL fulfillment. No production payment bypass.
- Hashed opaque access token; signed HttpOnly cookies; clean-URL exchange; device binding; independent atomic Start; short play permits; private R2 delivery with D1 recheck, no-store, sandbox/CSP and forensic/visible markers.
- Migrations 0001_commerce.sql and 0002_import_state.sql applied locally. Atomic snapshots/fulfillment/import-state tests pass.
- Idempotent importer preserves metadata/version history and rollback. Two local imports completed: 35 products, 35 versions, 70 original/delivery uploads. Source and minified HTML remain outside public/Git in original directory and ignored .private/products.
- 35 real-simulation WebP thumbnails generated; contact sheet inspected. Public thumbnails and hash metadata committed.
- Vanilla storefront immediately after Cube Jump, cart/search, Gmail/Turnstile checkout UI, payment screen, access page, Start confirmation and runtime wrapper.
- Existing contact-FAB child-click defect and unversioned JS/CSS/MJS immutable-cache rules fixed.
- SePay route reconciled to the existing saved singular endpoint `/api/webhook/sepay`; plural route remains closed. Signed webhook fixture and invalid-signature tests use the actual saved path. No provider mutation.
- First admin slice: `/admin` shell, dashboard, searchable order list, product list/basic edit, private version history and rollback without deleting R2 objects; edits/rollback have atomic D1 audits. Exact signed Cloudflare Access JWT email/audience/issuer tests and mobile browser rendering pass. No auth bypass was added to local or production code.
- Admin can create an inactive draft with safe default price/duration and no version; it cannot appear in the public catalog until a validated HTML version is attached and it is deliberately activated. Creation is audited and duplicate slugs reject. Upload and activation workflow remains incomplete.
- Admin bulk metadata editor updates 1–25 selected products per request with per-product audit. Optimistic updated_at guard reports skipped conflicts; versionless drafts cannot be bulk-activated. No bulk HTML overwrite/deletion.
- Admin prepared HTML upload: local CLI reuses the established conservative transform and saves a private JSON package; Worker verifies byte hashes and 2 MiB limits, writes original/delivery to private R2 before publishing the new D1 version pointer and audit. A duplicate original hash is idempotent. Admin WebP replacement writes private R2 and serves only the current image through a narrow public Worker route, without public bucket access. New drafts remain inactive after upload.
- Admin order detail shows immutable item price/version snapshots, entitlements and timing, linked or code-matched payments, support notes and manual refund records. Search supports Gmail, ID, BGZ, SePay reference/ID, date and product title/slug. No checkout or access hashes are returned.
- Admin can add audited internal support notes and reissue a paid order's access link after recording customer verification. Reissue atomically rotates the hashed token and session generation, optionally resets device binding, and displays the raw replacement URL once. Old links and sessions fail; neither access nor device hashes appear in order detail.
- Admin can search unmatched SePay transactions and manually reconcile a valid inbound, correct-bank, sufficiently funded payment to a pending order. Explicit review note and separate overpayment/code-mismatch confirmations are required. One D1 batch pays the order, creates entitlements through the existing trigger, marks the payment reconciled and audits the action. Underpayment, wrong bank and outgoing transfers cannot be fulfilled through this action.
- Admin can record a refund request for a paid order, capped against all outstanding/completed requests, then record completion only after confirming a manual transfer outside the system. Completion may revoke entitlements. Both transitions are audited. No bank transfer API is called.
- Admin can stream complete CSV exports of orders, payments and products through authenticated routes. UTF-8 BOM aids spreadsheet import and string cells that could execute spreadsheet formulas are neutralized; exports are private and no-store.
- Admin can preview any stored product version through an authenticated private R2 route inside a sandboxed modal iframe. Delivery has no-store/CSP restrictions; closing the modal unloads the simulation. Unauthorized and wrong-product requests are denied.
- Admin can make audited, reasoned entitlement support adjustments: extend an unstarted activation deadline, extend an active run, reopen an activation-expired right, or revoke one. Each action is guarded by current entitlement state and writes a support note.

## Cloudflare: local versus remote
Isolated preview resources were created in the authenticated account: D1 `bingenz-commerce-preview` (45e95b13-841f-4e71-b21c-5055758f8607, APAC) and private R2 bucket `bingenz-commerce-preview` (APAC, Standard). `wrangler.preview.toml` binds only these resources to a separate Worker name and enables logs/traces. Both remote migrations are applied and verified: `d1_migrations` lists 0001/0002 and all four triggers exist. The first remote apply failed atomically on D1 trigger `CASE ... END` parsing; parenthesizing CASE expressions in migration 0001 resolved it, with 23/23 local tests still passing. All 35 reviewed original/delivery pairs were uploaded to private preview R2 and imported into preview D1; remote queries confirm 35 products, 35 versions, 35 import markers, 35 active products and zero missing version pointers. A downloaded delivery object matched its expected SHA-256. No preview Worker deployment or secret/configuration write yet. Existing production Worker and the two unrelated D1 databases remain untouched.
Fresh read-only checks before creation showed remote R2 empty; D1 listed only the two unrelated databases below; deployments list confirmed the version above.

- Existing account Worker: bingenz-web-static; bingenz.com/www.bingenz.com; bingenz-web-static.lnth.workers.dev.
- Remote resources created by this task: isolated preview D1 and R2 above; two commerce migrations and 35-product import applied only to preview. No secret writes/Access or Turnstile changes/deployments yet.
- R2 subscription activated by owner. No remote commerce bucket or binding.
- Existing D1: bingenz-db (5fe27fd2-18ef-402e-aa46-abc424732474), cube-jump-chat-logs (faa75ad6-a591-4691-8d3f-1d81b3a5a72f). Do not alter unrelated resources.
- Local-only config wrangler.local.toml: Worker bingenz-commerce-local; D1 DB / bingenz-commerce-local / placeholder UUID 00000000-0000-0000-0000-000000000000; R2 SIMULATIONS / bingenz-commerce-local; ASSETS.
- Local persistence: ignored .wrangler/state/v3. Local products 35; remote preview products imported by task 35; remote production products imported by task 0; generated thumbnails 35.
- Production wrangler.toml remains static-only. Preview config/resources do not exist.
- Access: JWT helper exists and admin routes fail closed. Application/Google IdP/policy/audience not configured or verified.
- Turnstile: client/server code and mocked tests exist; production widget/secret and real-token/replay verification pending.

## SePay: actual configuration at handoff
Authenticated session is AVAILABLE in Codex in-app browser at https://my.sepay.vn/webhooks, verified again this resume. Earlier statements requiring session restoration were incorrect: no Chrome surface did not mean no authenticated in-app session.

Two enabled webhooks were observed:
- BinGenZ payment, ID 56829: HMAC-SHA256, incoming transfers, JSON, one selected TPBank API main account, automatic retries enabled, payment verification enabled. List reports no delivery yet.
- Cube Jump VietQR payment: unrelated existing enabled HMAC integration; do not modify.

Saved BinGenZ endpoint: https://bingenz.com/api/webhook/sepay (singular). Source now matches this exact path; regression tests reject plural. This is local code only and has not been deployed/provider-tested.

BGZ recognition/filter is NOT verified. Filter screen showed CJ and MP choices, not BGZ; selection was not conclusively checked. General payment-code configuration remains uninspected. Only-send-with-payment-code checkbox is unchecked; consecutive-error alerts are disabled.

No HMAC secret revealed/copied/generated/rotated by this task. Provider-to-Worker secret matching is pending. No official send-test, real payment or refund performed. Existing BinGenZ webhook creation history is unknown; do not attribute it to this task. Edit dialog cancelled without saving. Banking values are deliberately omitted here.

## Required configuration names
Secrets: SESSION_SECRET, ABUSE_HASH_KEY, SEPAY_WEBHOOK_SECRET, TURNSTILE_SECRET_KEY, BANK_ACCOUNT_NUMBER.
Non-secret: BANK_CODE, ADMIN_EMAIL, ACCESS_TEAM_DOMAIN, ACCESS_AUD, TURNSTILE_SITE_KEY, TURNSTILE_HOSTNAMES.
Bindings: DB, SIMULATIONS, ASSETS. .dev.vars.example has placeholders; no production secrets set by task.

## Verification and known gaps
- Current npm test: 24/24 PASS. Includes SQLite, real workerd/D1/R2, mocked provider validation, signed Access JWT fixtures, audited admin draft/edit/version rollback/bulk/HTML and thumbnail uploads, support recovery, payment reconciliation, manual refund records, entitlement adjustments, paged CSV export, private delivery check and mobile admin browser, paid claim/access/Start/sandbox runtime. Preview Wrangler dry-run bundles all 51 public assets and Worker bindings successfully; it proves packaging, not remote operation.
- Storefront 1440/390/360: 35 cards, placement, four desktop/two phone columns, cart persistence/removal, search, native dialog Escape/focus, no overflow/page errors. Screenshots inspected.
- Existing-site regression: themes/modals/contact/old images/Cube Jump presence pass. Complete social-link/copy/game-navigation assertions still pending.
- 35/35 originals passed baseline desktop/mobile load and initial interaction. Minified deliveries loaded for thumbnails. Full-cycle protected-wrapper tests remain pending for ALL 35.
- Admin is PARTIAL: dashboard, order search/detail, payment reconciliation, manual refund records, CSV exports, private version preview, inactive draft creation, basic product edit/list, version rollback, bulk metadata edit, prepared HTML upload and WebP replacement, support notes, entitlement adjustments and access recovery/device reset. Safe archival/deletion rules and some end-to-end admin validation remain incomplete. HTML upload requires a local preparation step; server verifies integrity but does not independently re-minify. Cloudflare Access outer policy is not configured.
- Exact expiration/activation-deadline race coverage, complete unpaid checkout-to-payment UI and live QR/provider tests remain incomplete. Signed JWT fixture coverage exists; live Access policy verification does not.
- Review same-second SePay timestamps versus millisecond order creation: current payment fixtures shift order creation two seconds earlier. This boundary is not yet proven.
- Legacy modal focus management remains incomplete. Invalid access-link errors are currently JSON rather than polished recovery UI.
- Operational README/deploy scripts need finalization. package.json shortcuts do not all select local config; use explicit commands below.
- Client-delivered source is not perfect DRM. No requirements waived; incomplete work is not deferred scope.

## Exact next action after a future Continue
First follow Section 41.9 and verify Git/provider/resource state. Continue the admin milestone with safe archival/deletion rules and end-to-end admin validation. Then finish customer/security/full35 simulation coverage and accessibility. Preview storage is provisioned; configure and verify Access, Turnstile, SePay HMAC/BGZ/QR on preview; complete Section 33 gates before master release and production smoke tests.

## Blockers, owner interaction, rollback
No confirmed login/OTP/permission blocker now. Remote permissions/Google Access setup remain unverified, not assumed blocked. No current owner action required. R2 activation is resolved.
Safe implementation rollback: e48afdc before payment reconciliation, then current checkpoint. Production untouched by task; no deploy until all gates pass.

## Resume commands
    git status --short --branch
    git log -5 --oneline
    git diff
    npm test
    npx wrangler d1 migrations apply DB --local --config wrangler.local.toml
    node scripts/prepare-products.mjs C:/Users/Acer/Downloads/QuickShare_2609122051
    node scripts/import-products.mjs
    npx wrangler dev --config wrangler.local.toml --port 4173
    node scripts/test-storefront.mjs
    node scripts/baseline-site.mjs http://127.0.0.1:4173
    npx wrangler r2 bucket list
    npx wrangler d1 list
    npx wrangler deployments list

Do not rerun preparation/import unless source/local state requires it. Recheck local server availability after disconnection; session IDs are not durable. No running import/test is needed for recovery.
