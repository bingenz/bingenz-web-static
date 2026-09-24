# Commerce implementation progress

## 2026-09-23 production recovery checkpoint

- UTC checkpoint: 2026-09-23T10:18:09Z.
- Current branch/commit: `codex/commerce-storefront` at `5f0f4966ed4750b6dedef0177e7c8c48ee229eb8`.
- Verified local state: the branch contains the complete commerce Worker history and is ahead of `master`; the working tree has a modified `wrangler.toml` plus untracked handoff and two Wrangler backup files. No user changes were discarded.
- Security finding: the uncommitted production Wrangler config contains a bank destination value. It must be preserved locally for comparison but removed from version-controlled configuration and supplied through the production secret binding before any commit or push. The value is intentionally not recorded here.
- Intended next action: establish a timestamped local safety branch, refresh remote refs read-only, inspect the source/payment/migrations/tests, then inspect authenticated Chrome sessions for SePay and Cloudflare. No production mutation is authorized before the deployed version, failed transaction, webhook evidence, data integrity, and rollback point are identified.
- Known non-secret target: Worker `bingenz-web-static`; D1 binding `DB` to `bingenz-commerce`; R2 binding `SIMULATIONS` to `bingenz-commerce`; assets binding `ASSETS`; production branch must become GitHub `master`.
- External status: not yet reverified in this session. Prior documentation is stale and must not be treated as current.
- Blockers: none yet. Stop only for authentication, a permission grant, or secure secret entry.
- Exact resume action: inspect `git diff`, create `backup/production-before-sepay-fix-20260923`, run `git fetch --prune`, then open the existing Chrome tabs for SePay and Cloudflare read-only.

### 2026-09-23T10:23:36Z read-only external audit

- Created local rollback branch `backup/production-before-sepay-fix-20260923` at `5f0f4966ed4750b6dedef0177e7c8c48ee229eb8`.
- Refreshed GitHub read-only: `origin/master` is `a8f00930a602c05f8f3f77742442300ca6453746`; it contains two remote-only website edits and still lacks the commerce Worker history. The repair branch must integrate those edits without rewriting shared history.
- Cloudflare browser login reached the authenticator-code checkpoint. No code was entered and no Cloudflare dashboard state was changed. Continue Cloudflare inspection with already-authenticated Wrangler where possible; user 2FA is required for dashboard-only evidence.
- SePay read-only verification: live mode; TPBank API account is marked connected; synchronization is enabled for incoming transfers and balance, but the account-level keyword allowlist contains only `CJ`. This excludes `BGZ` transfers before they enter SePay.
- SePay read-only verification: webhook `#57962` `BinGenZ Production` is enabled, targets the singular `/api/webhook/sepay` production URL, is incoming JSON, selects the TPBank main account, uses HMAC-SHA256, retries, consecutive-failure alerts, payment verification, `only send when payment code`, and the `BGZ` webhook prefix filter.
- SePay read-only verification: the active global `BGZ` recognition pattern requires exactly 12 numeric suffix characters, while application codes are exactly 12 uppercase alphanumeric suffix characters. This mismatch can prevent code recognition even after synchronization.
- SePay evidence: the BinGenZ webhook has zero delivery-log rows and the transactions list contains no recent BinGenZ/BGZ transaction. This classifies the observed failure before the Worker: the payment was not synchronized/recognized and therefore no webhook was sent.
- Intended next action: use Wrangler read-only commands to verify the current production deployment, bindings, secret names, migrations, D1 order/payment state and R2 counts without printing secrets or customer data.

### 2026-09-23T10:35:02Z Cloudflare production verification

- Wrangler OAuth is authenticated to the expected Cloudflare account. Latest production deployment is version `4c7d4749-975f-4dc6-97e5-fd0be33b4553`, created 2026-09-19T10:25:43Z from a direct version upload, not Git.
- Downloaded the deployed version metadata through the official Cloudflare API and compared hashes without storing source or printing configuration values. Deployed `worker.js` SHA-256 is `2bb7400b33ff7883456d1c0ed29d5c10e1576f05959304d08f502d30afad49dd`; a fresh local Wrangler dry-run produces the exact same byte length and hash. Deployed `_headers` also exactly matches local `public/_headers`.
- Production bindings are present: D1 `DB`, R2 `SIMULATIONS`, and static assets `ASSETS`. Secret names present are `ABUSE_HASH_KEY`, `SEPAY_WEBHOOK_SECRET`, `SESSION_SECRET`, and `TURNSTILE_SECRET_KEY`. The bank destination is currently a plain environment variable in the deployed version and must be migrated to a secret before the Git release.
- Production D1 is intact: 35 products, all 35 active, 35 versions, 3 orders, 0 payments, 0 webhook events, and 0 entitlements. Order summary shows two expired rows and one still stored as pending but past its 2026-09-19 expiry; no order was paid by the Worker. Duplicate payment IDs, duplicate entitlements, and orders without items are all zero.
- All three production order codes have a 12-character alphanumeric suffix containing letters; none is numeric-only. Therefore the current SePay digits-only `BGZ` recognition rule cannot recognize any existing production order code.
- Production D1 records migrations 0001–0004. The repository lacks `0004_fix_payment_trigger.sql`; the live `match_payment` trigger was recovered read-only and differs from local migration 0003 by relying on receipt time rather than provider transaction time. Reconstruct migration history and add a forward migration restoring the required exact payment-window checks before release.
- Production R2 is intact: exactly 70 private objects (35 originals and 35 deliveries). Every expected key and byte size matches `PREPARED_PRODUCTS.json`; there are no missing, extra, or size-mismatched objects.
- Production smoke: `/api/catalog` returns HTTP 200 with 35 products and private/no-store caching; webhook GET returns 404; a deliberately invalid HMAC POST returns 401 `{"success":false}` in 303 ms and writes no payment/event row.
- Intended next action: reconstruct the missing production migration safely, audit code/tests against the current official SePay contract, remove the bank value from versioned Wrangler config, rerun tests/dry-run, then correct SePay filters and run an official signed test.

### Pre-operation checkpoint: official SePay signed test

- Branch: `codex/sepay-payment-deploy-fix`; base commit remains `5f0f4966ed4750b6dedef0177e7c8c48ee229eb8` with the documented working changes.
- Local outcome: reconstructed missing migration 0004, added forward migration 0005 restoring transaction-time window checks while allowing delayed authenticated delivery, updated migration consumers, removed the bank destination from versioned Wrangler configuration, and added a delayed-delivery regression. `npm test` exits successfully.
- Intended production action: use SePay webhook `#57962` official `Gửi thử` once, without changing its configuration, to verify the existing HMAC secret pair and production endpoint. This may add one provider test event/payment-review record but cannot match a real order code by design.
- Rollback: no code/config deployment accompanies the test. If it fails, inspect the SePay response and Worker/D1 evidence; do not weaken authentication.
- Exact next action: invoke `Gửi thử`, record HTTP status/body and D1 count delta, then return to code/config remediation.

### 2026-09-23 official SePay signed-test result

- SePay webhook `#57962` official `Gửi thử` returned `HTTP 0 - 22 : The requested URL returned error: 400 Bad Request`. No BinGenZ delivery-history row was created, and production D1 remained at zero payments and zero webhook events.
- A deliberately invalid signature against the same endpoint returns 401, whereas the official signed test reached the post-HMAC 400 validation path. Official SePay documentation states that the mock transaction ID is normally `0`; the Worker required a strictly positive ID. This is the immediate test-contract defect, separate from the account keyword and BGZ-pattern defects that prevented the real transfer from reaching the webhook.
- Remediation in progress: accept signed, schema-valid ID `0` as a non-persisting health test that returns `{"success":true}`. It cannot create a payment, webhook event, entitlement, or order transition. Real transaction IDs remain strictly positive and follow the existing idempotent persistence path.
- Production rollback is not needed because this failed test made no Cloudflare, database, or provider-configuration change. Exact next action: complete the regression, rerun the full local suite and bundle dry-run, then release through the Git-backed deployment path before retrying `Gửi thử`.

### Pre-operation checkpoint: production migration and bank-secret conversion

- Release candidate: merge commit `04fbca5`, which includes `origin/master` `a8f0093` without history rewriting. Post-merge `npm test` passes 36/36 and the production Wrangler dry-run succeeds.
- Remote pre-state: D1 records 0001–0004 and reports only `0005_restore_payment_window.sql` pending. The Worker has four existing secret-text bindings; `BANK_ACCOUNT_NUMBER` is absent from the secret list because the active deployment still stores that value as a plain variable.
- Intended production actions: apply only migration 0005 to the existing `bingenz-commerce` D1, then replace the existing bank destination binding with a same-value `secret_text` binding without printing or committing the value. No D1/R2 resource is recreated and no customer/payment row is edited.
- Rollback: migration 0005 changes only `match_payment`; if required, restore the recovered 0004 trigger body with a forward corrective migration, never by deleting migration history. Secret conversion preserves the same runtime value; rollback should use another secret version, never return the value to Git/plain configuration.
- Deployment path: Cloudflare native Workers Builds is preferred for `master`. Its one-time GitHub App authorization and Cloudflare dashboard 2FA are explicit owner checkpoints; do not substitute another manual direct release as the long-term path.
- Exact next action: apply remote migration 0005, verify migration/trigger and unchanged row counts, then perform the same-value secret conversion and verify only the binding type/version changed.

### 2026-09-23 production migration, secret, and Git-build result

- Applied production migration 0005 successfully. A fresh migration list reports none pending; the live `match_payment` SQL contains both provider transaction-time bounds. Production remains 3 orders, 0 payments, 0 webhook events and 0 entitlements.
- Pushing `codex/sepay-payment-deploy-fix` triggered the existing Cloudflare Workers Builds integration. GitHub check `Workers Builds: bingenz-web-static` completed successfully and created undeployed preview version `8dd8eaa3-4151-498c-b53a-9555e55ac867`, proving GitHub-to-Cloudflare build connectivity.
- Because that preview was newer than the active version, legacy `wrangler secret put` correctly refused an immediate secret deployment. Recovered the existing plain bank destination in memory from active version metadata and used `wrangler versions secret put` through stdin. Undeployed version `5b38b767-10df-42be-a9fe-337aa65a5763` now has `BANK_ACCOUNT_NUMBER` as `secret_text`; the value was neither printed nor written to Git.
- Production traffic is still 100% on `4c7d4749-975f-4dc6-97e5-fd0be33b4553`; staging the secret did not change traffic. The next `master` Git build must inherit the five secret bindings, deploy the candidate, and be verified before SePay's official test is retried.

### 2026-09-24 production release and provider verification

- GitHub pull request #1 merged to `master` at `ff1b40bbb57f9e00c241f18650e1cfcbd3aae242`. The Cloudflare Workers Builds check completed successfully and automatically deployed version `e10263e9-2a36-4571-972f-49dcfac8d1cf` to 100% production traffic. This verifies the `master` GitHub-to-Cloudflare release path.
- The active version contains D1/R2/assets bindings, all non-secret production variables, and five `secret_text` bindings including `BANK_ACCOUNT_NUMBER`. Production smoke passes: catalog HTTP 200 with 35 products/private no-store, webhook GET 404, and invalid-HMAC POST 401 `{"success":false}`.
- Updated the TPBank synchronization allowlist from `CJ` to `CJ,BGZ`, preserving Cube Jump. Updated the active BGZ recognition rule from exactly 12 numeric characters to exactly 12 alphanumeric characters; SePay displayed successful-save confirmation for both changes.
- Retried webhook #57962 official `Gửi thử`: `HTTP 200` in `321ms`. The Worker intentionally did not persist the signed mock ID 0; D1 remained 3 orders, 0 payments, 0 webhook events and 0 entitlements.
- SePay still shows 25 historical transactions and no BGZ transaction after the configuration change, so the previously excluded transfer was not imported retroactively. Do not fabricate a payment or fulfill the expired order automatically; any historical reconciliation still requires explicit owner authorization and bank-statement verification.
- Rollback: revert traffic to version `4c7d4749-975f-4dc6-97e5-fd0be33b4553` only for a Worker regression; preserve D1/R2 and migration history. Restore SePay's earlier filters only if deliberately disabling BinGenZ intake. Never return the bank destination to plain Git/config.

Last updated: 2026-09-24 Asia/Saigon.

## Handoff
Owner resumed implementation after the previous documentation-only handoff. Work is active on the admin milestone; production remains untouched.

- Branch: codex/commerce-storefront. Latest committed checkpoint before this test update: 5bc3147 (canonical live-preview asset shells); admin browser test changes are pending a checkpoint.
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
- Admin can create an inactive draft with safe default price/duration and no version; it cannot appear in the public catalog until a validated HTML version is attached and it is deliberately activated. Creation is audited and duplicate slugs reject. Prepared upload and deliberate activation are implemented.
- Admin can change the default activation deadline (1–365 days) through a signed Access-gated settings form/API. The setting change is audited and only future order-item snapshots use the new value; existing rights are unchanged. Per-product overrides remain available.
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
Isolated preview resources were created in the authenticated account: D1 `bingenz-commerce-preview` (45e95b13-841f-4e71-b21c-5055758f8607, APAC) and private R2 bucket `bingenz-commerce-preview` (APAC, Standard). `wrangler.preview.toml` binds only these resources to a separate Worker name and enables logs/traces. The first two remote migrations applied and all four triggers exist; migration 0003 is recorded below. The first remote apply failed atomically on D1 trigger `CASE ... END` parsing; parenthesizing CASE expressions in migration 0001 resolved it. All 35 reviewed original/delivery pairs were uploaded to private preview R2 and imported into preview D1; remote queries confirm 35 products, 35 versions, 35 import markers, 35 active products and zero missing version pointers. A full read-only preview R2 audit downloaded all 70 original/delivery objects into temporary local files and verified every byte length and SHA-256 against the private prepared manifest (70/70 pass); temporary files were removed. The separate preview Worker is now deployed at `https://bingenz-commerce-preview.lnth.workers.dev`; only independent random `SESSION_SECRET` and `ABUSE_HASH_KEY` were set in its secret store. No SePay/Turnstile/banking secret, Access policy or production configuration was changed. Existing production Worker and the two unrelated D1 databases remain untouched.
Preview migration `0003_payment_second_precision.sql` applied successfully only to D1 `bingenz-commerce-preview`. Remote `d1_migrations` lists 0001/0002/0003, the `match_payment` trigger contains the second-precision comparison, and all 35 imported products remain present. Production D1/Worker were not changed. The current local suite is 31/31 and includes same-second acceptance and previous-second rejection.
Fresh read-only checks before creation showed remote R2 empty; D1 listed only the two unrelated databases below; deployments list confirmed the version above.

- Existing account Worker: bingenz-web-static; bingenz.com/www.bingenz.com; bingenz-web-static.lnth.workers.dev.
- Remote resources created by this task: isolated preview D1/R2 and separate preview Worker above; three commerce migrations and 35-product import applied only to preview. Preview Worker has two independent random session/abuse secrets; no Access/Turnstile/SePay change or production deployment.
- R2 subscription activated by owner; isolated preview commerce bucket exists. No production commerce bucket or binding.
- Existing D1: bingenz-db (5fe27fd2-18ef-402e-aa46-abc424732474), cube-jump-chat-logs (faa75ad6-a591-4691-8d3f-1d81b3a5a72f). Do not alter unrelated resources.
- Local-only config wrangler.local.toml: Worker bingenz-commerce-local; D1 DB / bingenz-commerce-local / placeholder UUID 00000000-0000-0000-0000-000000000000; R2 SIMULATIONS / bingenz-commerce-local; ASSETS.
- Local persistence: ignored .wrangler/state/v3. Local products 35; remote preview products imported by task 35; remote production products imported by task 0; generated thumbnails 35.
- Production wrangler.toml remains static-only. Preview Worker latest verified version is `c3c5b551-2bd7-492d-900c-29f18281b9b5`; production remains `ac96a0ba-d62e-4d86-9131-f1b4e4a3e981`.
- Access: JWT helper exists and admin routes fail closed. Read-only Cloudflare One check on 2026-09-17 found no Access applications; Applications page says "Finish your account setup" and requires an active plan before continuing. Google IdP/policy/audience are not configured or verified. Plan selection needs owner action; no plan was chosen.
- Turnstile: client/server code and mocked tests exist; production widget/secret and real-token/replay verification pending.
- Live preview smoke: `/api/catalog` returns 35, 390px browser shows two-column grid without overflow/errors, thumbnail serves WebP, private R2 path is 404, `/api/access` is 401, `/admin` is 503 fail-closed without Access config, `/admin.html` is 404, invalid access token redirects to recovery. First deploy exposed Cloudflare Assets' canonical `.html` redirect: shell fetches returned 307 to `/commerce`, breaking recovery/checkout. Worker now fetches canonical extensionless `/commerce` and `/admin`; re-deployed preview recovery and checkout shell return 200. `npm run test:preview` passes; it does not validate payment/provider/admin login.
- Read-only 2026-09-18 refresh: preview deployment remains `c3c5b551-2bd7-492d-900c-29f18281b9b5`, its secret list contains only `ABUSE_HASH_KEY` and `SESSION_SECRET`, and remote D1 still has 35 products. The authenticated SePay company configuration still shows payment-code recognition enabled with only active `CJ` and `MP` patterns; `BGZ` is absent. No external setting was changed in this refresh.

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
- Current npm test: 34/34 PASS. The signed-admin browser test creates an inactive draft, uploads prepared HTML and a private thumbnail, previews the delivery, activates it, then archives it; catalog visibility and audit actions are checked at each stage. New parallel checkout tests prove identical concurrent requests produce one pending order and six concurrent attempts from the same canonical Gmail yield exactly one rate-limit denial. A read-only preview D1 query found no duplicate pending Gmail/cart pair. Existing coverage includes SQLite, real workerd/D1/R2, mocked provider validation, signed Access JWT fixtures, admin support/payment/product operations, paged CSV export, same-second SePay boundary, private delivery and customer browser flows. Workerd rejects `fetch` redirect mode `error`; the QR proxy now uses `manual` and rejects non-OK/non-image responses. Preview Wrangler dry-run bundles all 51 public assets and Worker bindings successfully; it proves packaging, not remote operation.
- Storefront 1440/390/360: 35 cards, placement, four desktop/two phone columns, cart persistence/removal, search, native dialog Escape/focus, no overflow/page errors. Screenshots inspected.
- Existing-site regression rerun on local Worker at 1440/390/360: themes/modals/contact/old images/Cube Jump presence, social link targets, Cube Jump web navigation and contact/community copy buttons, no overflow/page errors pass. Legacy modal open now moves focus to the close button, traps Tab and restores the opener on close; service card is keyboard-activatable. These behaviors pass browser tests at all three widths. Storefront rerun at the same widths: 35 products, 4/2/2 columns, cart persistence/removal, keyboard focus and search pass.
- 35/35 originals passed baseline desktop/mobile load and initial interaction. All 35 prepared deliveries now pass a protected local Worker/D1/R2 paid-order cycle at desktop and mobile: Start, play permit, private runtime, primary interaction, no page errors/overflow, and expiry denial (70 browser views). Scenario-specific deeper behavior and live preview/production validation remain pending.
- Admin is PARTIAL: dashboard, order search/detail, payment reconciliation, manual refund records, CSV exports, private version preview, inactive draft creation, basic product edit/list, version rollback, bulk metadata edit, prepared HTML upload and WebP replacement, support notes, entitlement adjustments, safe empty-draft deletion/archive, access recovery/device reset and default activation settings. Desktop browser validation covers paid-order search, three support actions and a draft-to-private-upload-to-activation-to-archive cycle; end-to-end coverage of every admin operation remains incomplete. HTML upload requires a local preparation step; server verifies integrity but does not independently re-minify. Cloudflare Access outer policy is not configured.
- Expired-state server boundaries and unpaid checkout-to-paid browser UI are covered locally. Parallel pending-order uniqueness and canonical-Gmail rate-limit checks now pass; exact simultaneous expiration/activation transitions and live QR/provider tests remain incomplete. Signed JWT fixture coverage exists; live Access policy verification does not.
- Same-second SePay/order timestamp boundary is fixed in migration 0003 and covered locally; older payment fixtures still shift creation earlier, while the dedicated boundary test proves same-second acceptance and previous-second rejection. Live provider behavior remains pending.
- Invalid, revoked or wrong-device access links now redirect to a token-free manual-support page rather than showing raw JSON; access API and private runtime still fail closed. Browser recovery rendering passes locally.
- Operational README now covers architecture, explicit local/preview configs, migrations/imports, secret names, SePay prerequisites, release gates and recovery. package.json local/preview shortcuts select their exact config; unsafe generic production shortcuts were removed. Production release procedure remains pending production config and all Section 33 gates.
- Client-delivered source is not perfect DRM. No requirements waived; incomplete work is not deferred scope.

## Exact next action after a future Continue
First follow Section 41.9 and verify Git/provider/resource state. Continue scenario-specific deep simulation/admin/security coverage. Preview Worker/storage are provisioned and public catalog/security smoke tests pass; configure and verify Access, Turnstile, SePay HMAC/BGZ/QR on preview, then complete Section 33 gates before master release and production smoke tests.

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
