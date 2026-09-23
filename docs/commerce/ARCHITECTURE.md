# Commerce architecture

Keep public/ and the existing Worker name/domain. Add an ES-module Worker with native D1/R2/static asset bindings. Browser UI stays vanilla. Use separate preview resources; production deployment remains gated on the specification's verification requirements.

## Atomic data model

Orders have integer VND totals and immutable item title/price/runtime/version snapshots. A partial unique canonical-Gmail/cart key prevents duplicate pending orders. Expiration releases that key. Gmail canonical keys are abuse signals, never customer authentication. A separate random checkout secret in an HttpOnly cookie authorizes polling/claiming; knowing the email or payment code cannot claim a purchase. Requests from a second browser may reuse pending payment information but cannot acquire the original claim credential.

Payment inserts are unique by provider transaction ID. SQL triggers atomically match an exact pending order and create one entitlement per item on the first paid transition. Provider signatures are checked over timestamp + raw body with a five-minute replay window; transaction time is interpreted in SePay's Vietnam timezone and checked against order creation/deadline. Outgoing/wrong-bank events never fulfill. Payment amounts/codes/timing mismatches are review records. Manual reconciliation is privileged and audited.

The webhook creates entitlements; the checkout browser claims a freshly generated 256-bit access token after payment. Only its hash is persisted. Token exchange binds a random HttpOnly device cookie and issues a signed session cookie containing order ID and credential generation. Reissuing/resetting increments generations to invalidate existing sessions/play permits. Repeated Start uses a conditional SQL update; expiration is server-authoritative.

## Protected delivery

Keep originals and minified versions in private R2; no public domain or r2.dev URL. Pin order items to product versions. A short-lived signed play permit is scoped to the entitlement, session generation and device; delivery rechecks all database state. The runtime iframe is sandboxed with allow-scripts only (no same-origin, popups, navigation, forms or downloads). Responses add a restrictive sandbox CSP, frame-ancestors, no-store, no-referrer, and entitlement-only forensic markers. The wrapper stops the iframe on expiration and locks on failed authorization heartbeat. Source secrecy after client delivery is not perfect DRM.

## Admin and operations

All admin routes live below /admin and verify Access RS256 JWT signature, issuer, audience, expiry and exact configured email independently of the outer Access policy. Mutations require same-origin JSON requests. Every privileged mutation and support operation is audited. No custom passwords, customer accounts, coupons, automatic emails or bank transfers.

Use Node tests with the real Miniflare/workerd D1/R2 bindings for transaction/race/security checks, plus Playwright full UI and per-simulation tests. Local payment tests send properly signed fixtures; there is no production payment bypass. Import tooling stores no simulation source in Git, uses content hashes and stable source keys, and preserves seller-edited metadata. Refer to IMPLEMENTATION_SPEC.md for complete requirements.

## Official references verified

- https://developer.sepay.vn/en/sepay-webhooks/xac-thuc — raw-body HMAC and 300-second timestamp window.
- https://developers.cloudflare.com/d1/worker-api/d1-database/ — prepared statements and transactional batches.
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/ — Access JWT verification.
