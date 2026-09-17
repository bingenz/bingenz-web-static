# Commerce implementation progress

Last updated: 2026-09-17T17:04:23Z (2026-09-18 00:04 Asia/Saigon).

## Handoff
Owner resumed implementation after the previous documentation-only handoff. Work is active on the admin milestone; production remains untouched.

- Branch: codex/commerce-storefront. Working tree clean before this documentation update.
- Latest checkpoint: 118f51a (35 protected simulation cycles); earlier checkpoints cover payment timestamp precision, guarded product deletion, entitlement adjustments, private admin preview, CSV exports and manual refund records.
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
- Admin can permanently delete only a never-imported, inactive, versionless draft with no order items; deletion is audited. Uploaded or historical products must use archival, preserving their versions and order snapshots.

## Cloudflare: local versus remote
Isolated preview resources were created in the authenticated account: D1 `bingenz-commerce-preview` (45e95b13-841f-4e71-b21c-5055758f8607, APAC) and private R2 bucket `bingenz-commerce-preview` (APAC, Standard). `wrangler.preview.toml` binds only these resources to a separate Worker name and enables logs/traces. Both remote migrations are applied and verified: `d1_migrations` lists 0001/0002 and all four triggers exist. The first remote apply failed atomically on D1 trigger `CASE ... END` parsing; parenthesizing CASE expressions in migration 0001 resolved it, with 23/23 local tests still passing. All 35 reviewed original/delivery pairs were uploaded to private preview R2 and imported into preview D1; remote queries confirm 35 products, 35 versions, 35 import markers, 35 active products and zero missing version pointers. A downloaded delivery object matched its expected SHA-256. No preview Worker deployment or secret/configuration write yet. Existing production Worker and the two unrelated D1 databases remain untouched.
Preview migration `0003_payment_second_precision.sql` applied successfully only to D1 `bingenz-commerce-preview`. Remote `d1_migrations` lists 0001/0002/0003, the `match_payment` trigger contains the second-precision comparison, and all 35 imported products remain present. Production D1/Worker were not changed. Local 25/25 tests pass including a same-second match and previous-second rejection.
Fresh read-only checks before creation showed remote R2 empty; D1 listed only the two unrelated databases below; deployments list confirmed the version above.

- Existing account Worker: bingenz-web-static; bingenz.com/www.bingenz.com; bingenz-web-static.lnth.workers.dev.
- Remote resources created by this task: isolated preview D1 and R2 above; three commerce migrations and 35-product import applied only to preview. No secret writes/Access or Turnstile changes/deployments yet.
- R2 subscription activated by owner; isolated preview commerce bucket exists. No production commerce bucket or binding.
- Existing D1: bingenz-db (5fe27fd2-18ef-402e-aa46-abc424732474), cube-jump-chat-logs (faa75ad6-a591-4691-8d3f-1d81b3a5a72f). Do not alter unrelated resources.
- Local-only config wrangler.local.toml: Worker bingenz-commerce-local; D1 DB / bingenz-commerce-local / placeholder UUID 00000000-0000-0000-0000-000000000000; R2 SIMULATIONS / bingenz-commerce-local; ASSETS.
- Local persistence: ignored .wrangler/state/v3. Local products 35; remote preview products imported by task 35; remote production products imported by task 0; generated thumbnails 35.
- Production wrangler.toml remains static-only. Preview config/resources exist; preview Worker has not been deployed.
- Access: JWT helper exists and admin routes fail closed. Read-only Cloudflare One check on 2026-09-17 found no Access applications; Applications page says "Finish your account setup" and requires an active plan before continuing. Google IdP/policy/audience are not configured or verified. Plan selection needs owner action; no plan was chosen.
- Turnstile: client/server code and mocked tests exist; production widget/secret and real-token/replay verification pending.

## SePay: actual configuration at handoff
Authenticated session is AVAILABLE in Codex in-app browser at https://my.sepay.vn/webhooks, verified again this resume. Earlier statements requiring session restoration were incorrect: no Chrome surface did not mean no authenticated in-app session.

Two enabled webhooks were observed:
- BinGenZ payment, ID 56829: HMAC-SHA256, incoming transfers, JSON, one selected TPBank API main account, automatic retries enabled, payment verification enabled. List reports no delivery yet.
- Cube Jump VietQR payment: unrelated existing enabled HMAC integration; do not modify.

Saved BinGenZ endpoint: https://bingenz.com/api/webhook/sepay (singular). Source now matches this exact path; regression tests reject plural. This is local code only and has not been deployed/provider-tested.

Read-only SePay configuration check on 2026-09-17 confirms automatic payment-code recognition is enabled, but its only active patterns are `CJ` (6–12 alphanumeric suffix) and `MP` (6–8 numeric suffix); no `BGZ` pattern exists. The BinGenZ webhook's prefix filter has no selected prefix (the CJ/MP dropdown entries are available options, not selected tokens). Thus BGZ transactions are not currently recognized into the expected `code` field. The webhook's only-send-with-payment-code checkbox is unchecked; consecutive-error alerts are disabled. No SePay configuration was saved. Add an active `BGZ` + 12 alphanumeric suffix pattern after the receiving endpoint and HMAC secret have been verified; then run an official signed test.

No HMAC secret revealed/copied/generated/rotated by this task. Provider-to-Worker secret matching is pending. No official send-test, real payment or refund performed. Existing BinGenZ webhook creation history is unknown; do not attribute it to this task. Edit dialog cancelled without saving. Banking values are deliberately omitted here.

## Required configuration names
Secrets: SESSION_SECRET, ABUSE_HASH_KEY, SEPAY_WEBHOOK_SECRET, TURNSTILE_SECRET_KEY, BANK_ACCOUNT_NUMBER.
Non-secret: BANK_CODE, ADMIN_EMAIL, ACCESS_TEAM_DOMAIN, ACCESS_AUD, TURNSTILE_SITE_KEY, TURNSTILE_HOSTNAMES.
Bindings: DB, SIMULATIONS, ASSETS. .dev.vars.example has placeholders; no production secrets set by task.

## Verification and known gaps
- Current npm test: 30/30 PASS. Includes SQLite, real workerd/D1/R2, mocked provider validation, signed Access JWT fixtures, audited admin draft/edit/version rollback/bulk/HTML and thumbnail uploads, support recovery, payment reconciliation, manual refund records, entitlement adjustments, paged CSV export, same-second SePay boundary, private delivery check and mobile admin browser, paid claim/access/Start/sandbox runtime. New boundary cases prove activation-expired Start denial, expired play/permit/content denial, and expired unpaid QR/claim plus late-transfer review. Browser tests verify pending QR/countdown, automatic paid transition with a mocked QR provider and signed payment fixture, manual recovery guidance for invalid access links, and paid-order admin search/support/audit. Workerd rejects `fetch` redirect mode `error`; the QR proxy now uses `manual` and rejects non-OK/non-image responses. Preview Wrangler dry-run bundles all 51 public assets and Worker bindings successfully; it proves packaging, not remote operation.
- Storefront 1440/390/360: 35 cards, placement, four desktop/two phone columns, cart persistence/removal, search, native dialog Escape/focus, no overflow/page errors. Screenshots inspected.
- Existing-site regression rerun on local Worker at 1440/390/360: themes/modals/contact/old images/Cube Jump presence, social link targets, Cube Jump web navigation and contact/community copy buttons, no overflow/page errors pass. Legacy modal open now moves focus to the close button, traps Tab and restores the opener on close; service card is keyboard-activatable. These behaviors pass browser tests at all three widths. Storefront rerun at the same widths: 35 products, 4/2/2 columns, cart persistence/removal, keyboard focus and search pass.
- 35/35 originals passed baseline desktop/mobile load and initial interaction. All 35 prepared deliveries now pass a protected local Worker/D1/R2 paid-order cycle at desktop and mobile: Start, play permit, private runtime, primary interaction, no page errors/overflow, and expiry denial (70 browser views). Scenario-specific deeper behavior and live preview/production validation remain pending.
- Admin is PARTIAL: dashboard, order search/detail, payment reconciliation, manual refund records, CSV exports, private version preview, inactive draft creation, basic product edit/list, version rollback, bulk metadata edit, prepared HTML upload and WebP replacement, support notes, entitlement adjustments, safe empty-draft deletion/archive and access recovery/device reset. Desktop browser validation now covers paid-order search and three support actions; end-to-end coverage of every admin operation remains incomplete. HTML upload requires a local preparation step; server verifies integrity but does not independently re-minify. Cloudflare Access outer policy is not configured.
- Expired-state server boundaries and unpaid checkout-to-paid browser UI are now covered locally. Exact simultaneous expiration/activation races and live QR/provider tests remain incomplete. Signed JWT fixture coverage exists; live Access policy verification does not.
- Same-second SePay/order timestamp boundary is fixed in migration 0003 and covered locally; older payment fixtures still shift creation earlier, while the dedicated boundary test proves same-second acceptance and previous-second rejection. Live provider behavior remains pending.
- Invalid, revoked or wrong-device access links now redirect to a token-free manual-support page rather than showing raw JSON; access API and private runtime still fail closed. Browser recovery rendering passes locally.
- Operational README now covers architecture, explicit local/preview configs, migrations/imports, secret names, SePay prerequisites, release gates and recovery. package.json local/preview shortcuts select their exact config; unsafe generic production shortcuts were removed. Production release procedure remains pending production config and all Section 33 gates.
- Client-delivered source is not perfect DRM. No requirements waived; incomplete work is not deferred scope.

## Exact next action after a future Continue
First follow Section 41.9 and verify Git/provider/resource state. Continue with end-to-end admin and customer/security/full35 simulation coverage and accessibility. Preview storage is provisioned; configure and verify Access, Turnstile, SePay HMAC/BGZ/QR on preview; complete Section 33 gates before master release and production smoke tests.

## Blockers, owner interaction, rollback
Cloudflare One Access setup is blocked by the account's inactive-plan prompt. Owner must choose/activate an appropriate plan and handle any associated terms or payment; this task made no plan change. Turnstile widget configuration is awaiting the owner's hostname/action confirmation. SePay BGZ pattern is confirmed absent and needs configuration after endpoint/HMAC readiness. R2 activation is resolved. Local implementation/tests can continue meanwhile.
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
