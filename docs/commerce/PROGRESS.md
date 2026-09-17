# Commerce implementation progress

Last updated: 2026-09-17T06:39:09Z (13:39 Asia/Saigon).

## Handoff
Owner explicitly requested: update all four Section 41 files, commit a coherent checkpoint, then stop implementation. This is an owner-requested pause, not completion or a login blocker. No implementation after this documentation checkpoint.

- Branch: codex/commerce-storefront. Tree was clean before handoff documentation.
- Last implementation checkpoint: c386d07; prior: 553dfcd (import/thumbnails), 25d5c37 (Worker foundation), 52be239 (schema).
- Handoff checkpoint: documentation commit containing this file; resolve with git log -1 after commit.
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

## Cloudflare: local versus remote
Fresh read-only handoff checks: remote R2 list succeeds and is empty; D1 still lists only the two unrelated databases below; deployments list confirms the version above.

- Existing account Worker: bingenz-web-static; bingenz.com/www.bingenz.com; bingenz-web-static.lnth.workers.dev.
- Remote resources created by this task: NONE. No remote migrations/imports/secret writes/Access or Turnstile changes/deployments.
- R2 subscription activated by owner. No remote commerce bucket or binding.
- Existing D1: bingenz-db (5fe27fd2-18ef-402e-aa46-abc424732474), cube-jump-chat-logs (faa75ad6-a591-4691-8d3f-1d81b3a5a72f). Do not alter unrelated resources.
- Local-only config wrangler.local.toml: Worker bingenz-commerce-local; D1 DB / bingenz-commerce-local / placeholder UUID 00000000-0000-0000-0000-000000000000; R2 SIMULATIONS / bingenz-commerce-local; ASSETS.
- Local persistence: ignored .wrangler/state/v3. Local products 35; remote products imported by task 0; generated thumbnails 35.
- Production wrangler.toml remains static-only. Preview config/resources do not exist.
- Access: JWT helper exists and admin routes fail closed. Application/Google IdP/policy/audience not configured or verified.
- Turnstile: client/server code and mocked tests exist; production widget/secret and real-token/replay verification pending.

## SePay: actual configuration at handoff
Authenticated session is AVAILABLE in Codex in-app browser at https://my.sepay.vn/webhooks. Earlier statements requiring session restoration were incorrect: no Chrome surface did not mean no authenticated in-app session. Tab preserved for handoff.

Two enabled webhooks were observed:
- BinGenZ payment, ID 56829: HMAC-SHA256, incoming transfers, JSON, one selected TPBank API main account, automatic retries enabled, payment verification enabled. List reports no delivery yet.
- Cube Jump VietQR payment: unrelated existing enabled HMAC integration; do not modify.

Saved BinGenZ endpoint: https://bingenz.com/api/webhook/sepay (singular).
Current source endpoint: /api/webhooks/sepay (plural).
This mismatch MUST be reconciled before deployment/provider tests. No route/provider changes were made during handoff.

BGZ recognition/filter is NOT verified. Filter screen showed CJ and MP choices, not BGZ; selection was not conclusively checked. General payment-code configuration remains uninspected. Only-send-with-payment-code checkbox is unchecked; consecutive-error alerts are disabled.

No HMAC secret revealed/copied/generated/rotated by this task. Provider-to-Worker secret matching is pending. No official send-test, real payment or refund performed. Existing BinGenZ webhook creation history is unknown; do not attribute it to this task. Edit dialog cancelled without saving. Banking values are deliberately omitted here.

## Required configuration names
Secrets: SESSION_SECRET, ABUSE_HASH_KEY, SEPAY_WEBHOOK_SECRET, TURNSTILE_SECRET_KEY, BANK_ACCOUNT_NUMBER.
Non-secret: BANK_CODE, ADMIN_EMAIL, ACCESS_TEAM_DOMAIN, ACCESS_AUD, TURNSTILE_SITE_KEY, TURNSTILE_HOSTNAMES.
Bindings: DB, SIMULATIONS, ASSETS. .dev.vars.example has placeholders; no production secrets set by task.

## Verification and known gaps
- Final handoff npm test: 18/18 PASS. Includes SQLite, real workerd/D1/R2, mocked provider validation and Playwright paid claim/access/Start cancel+confirm/sandbox runtime.
- Storefront 1440/390/360: 35 cards, placement, four desktop/two phone columns, cart persistence/removal, search, native dialog Escape/focus, no overflow/page errors. Screenshots inspected.
- Existing-site regression: themes/modals/contact/old images/Cube Jump presence pass. Complete social-link/copy/game-navigation assertions still pending.
- 35/35 originals passed baseline desktop/mobile load and initial interaction. Minified deliveries loaded for thumbnails. Full-cycle protected-wrapper tests remain pending for ALL 35.
- Admin API/UI is NOT implemented. Missing dashboard, product editing/uploads/versions/bulk, reconciliation, recovery/device reset, support, manual refund records, export and operational audit actions.
- Exact expiration/activation-deadline race coverage, genuine signed Access JWT tests, complete unpaid checkout-to-payment UI and live QR/provider tests remain incomplete.
- Review same-second SePay timestamps versus millisecond order creation: current payment fixtures shift order creation two seconds earlier. This boundary is not yet proven.
- Legacy modal focus management remains incomplete. Invalid access-link errors are currently JSON rather than polished recovery UI.
- Operational README/deploy scripts need finalization. package.json shortcuts do not all select local config; use explicit commands below.
- Client-delivered source is not perfect DRM. No requirements waived; incomplete work is not deferred scope.

## Exact next action after a future Continue
First follow Section 41.9: full spec/state files, Git/diffs and actual provider/resource state. Then inspect src/worker.mjs against SePay #56829 and reconcile the singular/plural webhook endpoint contract, record the canonical route and add regression coverage. Do not change the provider until its endpoint is safely deployable.

Next implementation milestone: /admin APIs/UI behind adminIdentity plus exact-Origin guard, with atomic audited product/version/payment/support/recovery operations and signed-JWT tests. Then finish customer/security/full35 simulation coverage and accessibility. Provision isolated preview resources; verify Access, Turnstile, SePay HMAC/BGZ/QR; complete Section 33 gates before master release and production smoke tests.

## Blockers, owner interaction, rollback
No confirmed login/OTP/permission blocker now. Paused ONLY by owner instruction. Remote permissions/Google Access setup remain unverified, not assumed blocked. No current owner action required. R2 activation is resolved.
Safe implementation rollback: c386d07 plus current documentation checkpoint. Production untouched by task; no deploy until all gates pass.

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
