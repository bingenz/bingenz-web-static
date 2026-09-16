# Verification matrix

No tests have run yet. Pending is not a pass.

| Area | Required verification | Status |
|---|---|---|
| Unit | Validation, pricing, payment matching, entitlement state machine | Pending |
| Integration | D1 atomic transitions, idempotency, R2 private delivery | Pending |
| Payment/webhook | Exact/under/over/late/unknown, duplicate, wrong bank, outgoing, invalid/replayed signature | Pending |
| Security | Tokens, device binding/reset, expiry, admin JWT, CSRF, price tampering | Pending |
| Storefront desktop | Existing features and full purchase flow | Pending |
| Storefront mobile | Two columns, no overflow, purchase/access/runtime | Pending |
| Admin | All operations, audit, exports, recovery | Pending |
| Cloudflare Access | Exact Google account and JWT verification | Pending |
| Turnstile | Server validation and rejection | Pending |
| SePay | Official signed webhook test and BGZ recognition | Pending |
| Simulation inventory | Individually enumerate live HTML files before implementation | Pending |

## Individual simulations

Inventory pending; no simulations have been imported, captured, or tested.
Required columns: filename, product/slug, imported, thumbnail, desktop, mobile, runtime wrapper, console errors, minification/mangling, known issues.
