You are the lead engineer responsible for turning the existing BinGenZ static website into a production-ready storefront for paid interactive computer-science simulations.

You are expected to perform the implementation, infrastructure setup, migration, verification, and production-readiness work, not merely produce a plan.

## 1. Project and source of truth

Repository:

- GitHub repository: `bingenz/bingenz-web-static`
- Production branch: `master`
- Production domain: `bingenz.com`
- Existing frontend source: `public/`
- Existing technology: vanilla HTML, CSS, and JavaScript
- Existing Cloudflare configuration: inspect the current `wrangler.toml` before modifying anything.

If any legacy documentation or obsolete repository-level instructions conflict with the current product requirements in this prompt, update them to reflect the new architecture. Do not recreate or preserve the previous static-only restrictions.

Preserve the current BinGenZ visual identity and all existing functionality unless a change is required for this implementation.

Do not replace the public site with React, Vue, Next.js, or another heavy frontend framework.

Prefer:

- vanilla HTML/CSS/JS for public UI and admin UI;
- Cloudflare Workers for backend/API logic;
- Cloudflare D1 for relational data;
- private Cloudflare R2 for simulation files and product versions;
- Cloudflare Access + Google for admin authentication;
- Cloudflare Turnstile for checkout abuse protection.

A minimal Node/Wrangler/TypeScript toolchain may be added if it materially improves backend maintainability, testing, imports, migrations, or deployment.

Do not begin implementation until the repository, deployment configuration, and current simulation files have been fully inspected. Base architectural decisions on the actual current code and infrastructure rather than assumptions from this prompt.

## 2. Read everything before making architectural changes

Before implementing:

1. Read the entire repository, including all code, configuration, documentation, and README files.
2. Inspect the complete current website and understand its desktop/mobile behavior.
3. Inspect the current deployment configuration.
4. Inspect the current local simulation directory:
   `C:\Users\Acer\Downloads\QuickShare\_2609122051`
5. If running under WSL, also try the corresponding `/mnt/c/...` path.
6. Recursively inspect every current `.html` simulation file.
7. The directory is expected to contain approximately 35 HTML simulations, but the files currently present in that directory are authoritative because they may have been edited recently.
8. Do not use an older ZIP snapshot if the live directory is available.
9. Do not silently skip files. Report any parsing/import failures.

Understand how every simulation works before designing the serving wrapper.

## 3. Storefront placement and design

Add a new paid simulation store section immediately after the existing "Cube Jump Online" section.

Preserve the existing BinGenZ visual language:

- dark/light theme compatibility;
- existing typography and visual hierarchy;
- current gold/accent language;
- glass/surface treatment where appropriate;
- existing spacing philosophy.

The new section must feel native to the current site rather than like a third-party ecommerce widget.

### Product cards

Each product card must contain at minimum:

- product thumbnail;
- product name;
- price;
- compact Add to Cart action.

Default product price:

`10,000 VND`

Store monetary values as integer VND amounts, never floating point.

Use Vietnamese currency formatting such as `10.000 ₫` or the style already most consistent with the existing site.

### Responsive requirements

Mobile is extremely important.

On normal phone widths the product grid must be exactly:

- 2 columns;
- compact but readable;
- no horizontal overflow;
- thumbnails with a consistent aspect ratio;
- product names may use a two-line clamp;
- price remains clearly readable;
- buttons must remain finger-friendly.

Desktop may use 3 or 4 columns according to the available width.

Use sensible responsive breakpoints rather than hardcoding only one device width.

## 4. Product thumbnails

Do not spend generative-image quota creating 35 thumbnails.

Generate thumbnails locally from the actual simulations whenever practical.

Preferred workflow:

1. Open each simulation locally using Playwright or another local browser automation tool.
2. Wait until its initial visual state is stable.
3. Capture one representative screenshot.
4. Crop/resize consistently.
5. Produce optimized WebP thumbnails.
6. Store them under an appropriate public product-thumbnail asset directory.

If a specific simulation cannot be captured reliably, use one reusable professional fallback illustration rather than consuming AI image-generation quota.

Admin must later allow the thumbnail to be replaced manually.

## 5. Cart

Implement a professional cart.

Requirements:

- add product;
- remove product;
- clear cart;
- cart item count;
- total price;
- no duplicate quantity concept for the same digital product;
- buying the same product twice in one cart is not allowed;
- maximum cart size must never exceed the number of active products;
- cart may be persisted locally for convenience;
- local storage must never be trusted for pricing or authorization.

Server must always calculate prices from D1.

A manipulated browser request must not be able to change prices.

## 6. Customer identity

There are no customer accounts and no customer login.

Checkout asks for only one customer field:

- Gmail address.

Accept only valid `@gmail.com` addresses.

Normalize to lowercase.

For abuse detection only, also derive a Gmail canonical key by:

- removing any `+tag`;
- removing dots from the local part.

Preserve the originally submitted normalized Gmail address for order/support display.

Do not expose one buyer's Gmail address to another buyer.

No automatic customer account should be created.

## 7. Checkout anti-abuse

This storefront is inexpensive, so abuse controls should be useful but not intrusive.

Implement:

### Turnstile

Require a valid Cloudflare Turnstile token when creating a checkout/order.

Always validate Turnstile server-side.

### Pending-order reuse

Do not create unlimited duplicate orders.

When the same canonical Gmail address requests checkout for the same cart while an identical order is still pending and unexpired, return/reuse the existing pending order instead of creating another D1 order.

### Rate limiting

Add sensible server-side protection around order creation.

A reasonable starting policy is approximately:

- no more than 5 checkout creation attempts in 10 minutes from the same abuse key/IP;
- no more than 3 concurrently pending orders for the same canonical Gmail identity.

Adjust if Cloudflare's native Rate Limiting binding provides a cleaner implementation.

Do not bind legitimate purchases permanently to IP addresses.

Validate body size, cart size, product IDs, email length, and request shape.

## 8. Payment provider

Use SePay with the user's existing TPBank account.

Use only official current SePay documentation and the authenticated SePay dashboard.

The normal SePay management dashboard is under the official SePay service, and official developer documentation must be treated as authoritative.

Do not rely on stale integration examples found on random blogs.

### Bank/account handling

Do not hardcode the customer's TPBank account number, account holder name, API credentials, HMAC secret, or any banking credential into:

- Git;
- frontend JavaScript;
- HTML;
- D1 records that do not need it.

Use Cloudflare secrets/environment configuration.

If the user's currently authenticated browser already has SePay open, you may use browser automation to configure SePay.

If an action requires bank login credentials, OTP, biometric confirmation, or another human security challenge, stop only at that specific checkpoint and allow the user to complete the security step.

Never initiate a bank transfer.

Never perform a refund transfer automatically.

## 9. SePay payment codes

Every checkout order must receive a unique bank transfer payment code.

Format requirements:

- prefix: `BGZ`
- uppercase only;
- letters and numbers only;
- absolutely no spaces;
- no hyphens;
- no underscores;
- no punctuation.

Use cryptographically secure randomness.

Prefer an easy-to-read alphabet that avoids ambiguous characters where possible.

Example shape:

`BGZXXXXXXXXXX`

Do not simply use sequential database IDs.

Enforce a UNIQUE database constraint on the payment code.

Configure the corresponding SePay payment-code recognition/filter rules.

The QR transfer description should use the generated payment code.

## 10. QR checkout

Order payment window:

`15 minutes`

The payment UI must show:

- QR code;
- exact amount;
- payment content/code;
- Copy buttons where useful;
- bank/payment instructions;
- visible 15-minute countdown;
- waiting state;
- payment-success state;
- expired state.

The client should poll a safe public order-status endpoint or use an equally simple reliable mechanism.

Do not expose internal order data through that endpoint.

When payment becomes verified, transition the browser automatically to the paid access experience.

QR/order expiration must be based on server timestamps, not the customer's system clock.

An expired QR/order must not be automatically reactivated by refreshing the page.

If money arrives after the 15-minute payment deadline, classify it as a late/unmatched payment for admin review rather than automatically granting access.

## 11. SePay webhook security

Use SePay HMAC-SHA256 webhook authentication for production.

Implement all appropriate protections:

- HTTPS only;
- HMAC-SHA256 verification;
- timestamp/replay validation according to current SePay documentation;
- reject invalid signatures;
- verify transfer direction is incoming;
- verify target bank account;
- validate transaction payload;
- transaction deduplication;
- database UNIQUE constraint for the external SePay transaction ID/reference where appropriate;
- idempotent webhook handling;
- safe handling of webhook retries.

Return a valid success response for already-processed duplicate webhook deliveries without granting anything twice.

Do not use unauthenticated production webhooks.

If current SePay documentation publishes usable webhook source-IP ranges, configure an allowlist where appropriate in addition to HMAC, but do not make the system fragile if the provider officially recommends HMAC as the primary identity check.

## 12. Payment matching rules

Automatic fulfillment is allowed only when all of these conditions are satisfied:

- valid authenticated SePay webhook;
- incoming transfer;
- expected bank account;
- payment code exactly maps to a known pending order;
- transfer amount equals order total exactly;
- order has not already been fulfilled;
- payment is inside the valid 15-minute order window;
- transaction has not already been processed.

Never accept a browser request claiming that payment succeeded.

Underpayment:

- do not fulfill;
- classify for manual review.

Overpayment:

- do not fulfill automatically;
- classify for manual review.

Unknown code:

- manual/unmatched payment.

Late payment:

- manual review.

Duplicate webhook:

- idempotent success with no duplicate fulfillment.

Admin must be able to inspect and manually reconcile unmatched transactions.

All manual reconciliation actions must create an audit log.

## 13. Payment fulfillment and access URL

After successful payment, create one entitlement for every purchased product.

Generate one high-entropy opaque customer access token for the order.

Important:

- never store the raw access token in D1;
- store only a secure cryptographic hash;
- show the raw token only when issuing it;
- access URL shape may be similar to `/access/<opaque-token>`.

When the access URL is opened successfully:

1. validate the token server-side;
2. set an appropriate secure HttpOnly signed/session cookie;
3. remove the secret token from the visible browser URL through a redirect to a clean `/access` route.

Cookie requirements where applicable:

- Secure;
- HttpOnly;
- appropriate SameSite policy;
- narrow Path where practical.

The access page must clearly tell the buyer to keep the access link safe because there is no customer login.

## 14. Lost access link / support recovery

Do not implement automated email recovery.

If a user loses the access link, they contact the site owner manually.

Admin must therefore support recovery workflows.

Admin should be able to search by:

- Gmail;
- order ID;
- BGZ payment code;
- SePay transaction/reference;
- date;
- product.

After manually verifying the customer, admin must be able to:

- invalidate the previous access token;
- issue a new access token;
- copy the new customer access URL;
- optionally reset device binding;
- record an internal support note.

Reissuing a token must invalidate the old token.

## 15. Entitlement timing

Every purchased product is one independent entitlement.

Default runtime:

`15 minutes per purchased product`

Each item has its own Start button.

Starting Product A must not start Product B.

States should include at least:

- not_started;
- active;
- expired;
- activation_expired;
- revoked.

### Activation deadline

Default activation deadline:

`7 days after paid_at`

This value must be configurable in admin/settings and overrideable per product if useful.

If the entitlement has not started by the activation deadline:

- it becomes activation-expired;
- customer cannot start it;
- admin can extend/reopen it manually if support approves.

### Start behavior

When the customer presses Start:

- perform an atomic server-side transition;
- set `started_at` once;
- set `expires_at = started_at + configured_duration`;
- never reset the timer from the client;
- repeated requests must not extend the timer.

There is:

- no pause;
- no resume;
- no automatic reset.

Closing the tab does not stop time.

Reloading does not reset time.

When expired, show a clear Vietnamese state equivalent to:

`Đã hết hạn`

and a:

`Mua lại`

action.

## 16. Device/link sharing protection

This is a no-login product, but casual link sharing must be strongly discouraged.

Do not use permanent IP binding because legitimate mobile networks and VPNs change IP.

Use a secure device-session approach.

Recommended design:

- on first successful post-payment access, establish a strong random device secret in a Secure HttpOnly cookie;
- bind the order/access session to that device identifier;
- all play sessions must validate that device binding;
- allow only one bound device for the order by default;
- admin can reset device binding after support verification.

Do not use invasive browser fingerprinting.

A coarse browser/UA compatibility check may be used only as supplemental abuse detection, never as the primary credential.

Copying only the access URL to another browser must not be sufficient to play active entitlements once the order has been device-bound.

## 17. Protect the simulation source

The original simulation HTML files are paid assets.

They must NEVER be placed under a publicly addressable directory such as:

`public/products/...`

Do not expose raw R2 objects publicly.

Use a private R2 bucket.

Only a Worker that has validated:

- customer access;
- device binding;
- entitlement status;
- runtime expiration;

may read a simulation object.

R2 should be accessed through Worker bindings rather than public R2 URLs.

### Important security reality

Client-side HTML/JavaScript cannot be made mathematically impossible to inspect once a browser receives and executes it.

Do not claim that this implementation provides perfect DRM.

Instead implement the strongest practical anti-extraction measures that do not destroy the user experience.

Required measures:

1. Originals remain private in R2.
2. No permanent public content URL.
3. Authorized Worker delivery only.
4. Short-lived play/session authorization.
5. Play authorization must be tied to the entitlement and bound device.
6. `Cache-Control: private, no-store` or an equivalent strict anti-cache policy.
7. Never ship source maps.
8. Strip development comments and unnecessary metadata.
9. Minify production HTML/CSS/JS.
10. Apply safe JavaScript identifier mangling/minification where testing proves it does not break a simulation.
11. Do not use aggressive obfuscation blindly if it breaks event handlers or functionality.
12. Sandbox the simulation from the main storefront.
13. Prevent arbitrary framing by third-party sites.
14. Do not create an offline/service-worker cache of protected simulation files.
15. Generate an entitlement-specific forensic marker/watermark when serving a simulation.
16. Include a subtle nonintrusive visible license marker such as an abbreviated BGZ/order entitlement identifier where it does not interfere with the simulation.
17. Also inject non-security-critical hidden forensic identifiers into the delivered version to help identify redistributed copies.
18. Do not expose raw customer Gmail in the visible watermark.
19. Do not waste effort on fake protections such as disabling right-click as the primary defense.

Where a simulation's JavaScript cannot safely be minified/mangled, prioritize functionality and private authorized delivery.

Document clearly that full source secrecy would require moving the core simulation engine server-side or to another remote execution architecture.

That larger rewrite is outside this version unless it becomes necessary to satisfy functional requirements.

## 18. Simulation runtime wrapper

Do not navigate customers directly to a raw R2 HTML object.

Create a controlled play page/runtime wrapper.

The wrapper should:

- validate the entitlement;
- show remaining server-authoritative time;
- contain the simulation in an isolated context/iframe where practical;
- fit desktop and mobile safely;
- avoid leaking the customer access token to the simulation;
- avoid exposing privileged admin APIs;
- automatically stop/lock the simulation when server time expires;
- show the expired state and repurchase action.

The server must still reject protected content/session requests after expiration even if the client modifies JavaScript.

Use a short-lived runtime token/session rather than the long-lived order access token for protected content retrieval.

## 19. Product import pipeline

Create an idempotent local import tool for the simulations.

It must:

- scan the current local simulation directory;
- parse each HTML file;
- determine a useful product title from title/H1/content/filename;
- create a stable slug;
- compute SHA-256;
- upload the original/trusted asset to private R2;
- create a product version record;
- generate or associate a thumbnail;
- create/update the D1 product;
- default price to 10,000 VND;
- default runtime to 15 minutes;
- default activation deadline to 7 days;
- avoid creating duplicate products on repeated imports;
- preserve admin-edited metadata where appropriate;
- version changed HTML files rather than losing history.

Do not delete old product versions automatically.

Admin may later roll back to a previous version.

## 20. Product administration

Admin URL:

`bingenz.com/admin`

Admin must provide professional seller-operating functionality.

### Dashboard

Include useful summary cards/data such as:

- revenue today;
- revenue last 7 days;
- revenue last 30 days;
- paid order count;
- pending orders;
- expired pending orders;
- manual-review payments;
- active entitlements;
- recently paid orders;
- best-selling products;
- webhook failures/recent errors where practical.

Do not add artificial vanity metrics.

### Products

Admin can:

- create;
- edit;
- archive/unarchive;
- delete only when safe;
- change title;
- slug;
- description;
- price;
- runtime duration;
- activation deadline override;
- active/inactive;
- display order;
- category if useful;
- replace thumbnail;
- upload/replace HTML;
- inspect current version;
- inspect version history;
- roll back a version;
- preview a simulation using admin authorization.

Use archive rather than destructive deletion when historical order records reference a product.

### Bulk editing

Allow selected products to change practical shared properties such as:

- active state;
- price;
- duration;
- activation deadline;
- display/category fields.

### Orders

Search/filter/view:

- order number;
- Gmail;
- products;
- item price snapshots;
- total;
- status;
- BGZ payment code;
- created time;
- expiration time;
- paid time;
- SePay transaction;
- entitlement status.

### Payments

Provide:

- matched payments;
- unmatched payments;
- late payments;
- underpayments;
- overpayments;
- transaction details;
- reconciliation action;
- manual notes.

### Entitlements

Admin can:

- inspect not-started/active/expired/revoked status;
- see started_at/expires_at;
- extend activation deadline;
- optionally extend an active entitlement for support;
- revoke entitlement;
- reset device binding;
- reopen an activation-expired entitlement;
- reissue order access credentials where appropriate.

Every privileged mutation must be audited.

### Refunds

Refund processing is manual.

Do not implement automatic outgoing bank transfers.

Admin can record:

- refund requested;
- refund completed manually;
- amount;
- date;
- note;
- optional entitlement revocation.

### Support

Include support-oriented lookup and notes so lost-link cases can be resolved quickly.

### Export

Provide CSV export for useful datasets such as:

- orders;
- payments;
- products.

Escape CSV safely.

## 21. No promotion system

Do NOT implement:

- coupons;
- discount codes;
- promotional codes;
- percentage discounts;
- bundles;
- sale campaigns.

Keep the architecture capable of future extension without adding unused complexity now.

## 22. Admin authentication

There must be no custom admin password system.

Protect `/admin` and all admin API routes with Cloudflare Access using Google identity.

Only this exact Google account may be allowed:

`lengocthuan09@gmail.com`

Prefer to structure admin APIs under the protected admin path, for example:

`/admin/api/...`

so that Cloudflare Access policy coverage is difficult to misconfigure.

Use Cloudflare Access as the outer authentication layer.

Also perform defense-in-depth validation server-side using the current Cloudflare Access identity/JWT mechanism and verify that the authenticated email equals the configured admin email.

Do not trust an arbitrary client-supplied email header.

Mutating admin requests must also receive suitable CSRF/origin protection.

## 23. Database design

Use migrations.

Design a normalized D1 schema roughly covering:

- products;
- product_versions;
- orders;
- order_items;
- payments;
- entitlements;
- webhook_events;
- admin_audit_logs;
- application/settings values;
- optional support notes.

Exact names may differ if a cleaner schema is justified.

Important constraints should exist in SQL where possible, not only JavaScript.

Examples:

- product slug unique;
- BGZ payment code unique;
- SePay transaction identifier unique;
- order/item foreign keys;
- entitlement uniqueness for an order item where applicable.

Order items must store price/title snapshots so historical orders remain correct if product prices change later.

Use ISO/UTC timestamps internally and format for Vietnamese users in the UI.

## 24. Public API security

Public APIs must never expose:

- admin data;
- another user's orders;
- raw access-token hashes;
- R2 keys;
- Cloudflare secrets;
- SePay secrets;
- full webhook payload collections.

Use generic responses where exposing existence could enable enumeration.

Order IDs exposed publicly should be high entropy or paired with a separate secret rather than predictable integer IDs.

Apply strict input validation and prepared D1 statements.

## 25. UI for paid access

After successful purchase, show a polished purchase-access page containing each purchased product independently.

Each item should display:

- thumbnail/name;
- entitlement state;
- Start button if not started;
- remaining activation period if useful;
- 15-minute runtime information;
- countdown while active;
- expired state;
- repurchase button after expiration.

Explicitly explain before Start:

- runtime is 15 minutes;
- timer begins immediately when Start is confirmed;
- timer cannot be paused;
- closing the browser does not pause the timer.

A confirmation interaction before the irreversible Start action is appropriate.

Do not make Start easy to trigger accidentally.

## 26. Mobile simulation experience

The simulation play experience must be usable on phones.

For a vertical mobile viewport such as 9:16:

- keep the actual simulation content in a visually safe central region;
- avoid allowing the simulation to occupy the full height when that harms controls;
- approximately 3:4 to 5:7 central-content proportions are acceptable when appropriate;
- maintain balanced top/bottom spacing;
- prevent important content from being hidden behind browser chrome;
- account for `env(safe-area-inset-bottom)`;
- keep primary controls near the bottom where appropriate without pushing simulation content off-screen.

Where the original 35 simulations already implement their own responsive behavior, do not unnecessarily rewrite their algorithm logic.

The wrapper may provide responsive containment around them.

Test every simulation.

## 27. Accessibility and quality

Ensure:

- keyboard-accessible storefront controls;
- accessible modal/drawer behavior;
- focus management;
- meaningful button labels;
- sensible contrast in dark and light themes;
- reduced-motion consideration where practical;
- no accidental horizontal scroll;
- graceful loading/error states.

Visible customer-facing copy should primarily be Vietnamese and match the tone of the existing BinGenZ site.

Code/comments/documentation may remain English.

## 28. Cloudflare infrastructure

Use the user's existing Cloudflare account/project.

Create/configure as needed:

- Worker/static assets deployment;
- D1 database;
- private R2 bucket;
- D1 binding;
- R2 binding;
- Turnstile;
- secrets/environment variables;
- Cloudflare Access application/policies;
- relevant route configuration.

Use Cloudflare bindings rather than calling Cloudflare REST APIs from inside a Worker when a native Worker binding exists.

Do not expose R2 publicly.

Separate production secrets from development/test configuration.

Create `.dev.vars.example` or equivalent with placeholder names only.

Never commit real secrets.

## 29. SePay configuration

Configure SePay production integration completely where the current authenticated environment allows it.

Required production webhook:

- incoming transfers only;
- correct linked TPBank account;
- BGZ payment-code filter where supported;
- HMAC-SHA256 security;
- production webhook endpoint;
- suitable webhook failure alerting if readily available.

Generate a strong HMAC secret and store the matching value securely in Cloudflare secrets.

Use SePay's official webhook test/send feature to verify that the endpoint accepts valid signed events and rejects invalid ones.

Do not expose the HMAC secret in logs.

If SePay allows configuration through an authenticated official API and that is safer/reproducible than browser clicks, using the official API is acceptable.

## 30. Payment page QR

Use the official current VietQR/SePay-compatible mechanism.

Generate QR/payment data server-side or from validated server-provided values.

Never trust account number, amount, or payment description supplied by arbitrary browser input.

The payment page's QR must contain exactly the server-selected:

- TPBank destination;
- order total;
- BGZ payment code.

## 31. Testing

Do not consider the project complete because pages render.

Add automated tests for core business logic.

At minimum test:

### Orders

- price calculated server-side;
- duplicate product rejected;
- inactive product rejected;
- pending-order reuse;
- 15-minute expiration.

### Payment matcher

- correct code + correct amount;
- wrong code;
- underpayment;
- overpayment;
- unknown order;
- late payment;
- duplicate webhook;
- wrong bank account;
- outgoing transfer;
- invalid signature.

### Entitlements

- independent products;
- atomic start;
- repeated Start cannot extend time;
- 15-minute expiration;
- activation deadline;
- revoked entitlement;
- device binding;
- device reset;
- regenerated access token invalidates old token.

### Security

- raw R2 URL is unavailable;
- protected simulation cannot load without entitlement;
- expired entitlement cannot load content;
- wrong device cannot load content;
- customer cannot change price;
- admin API inaccessible without valid Cloudflare Access identity;
- old/replayed webhook cannot fulfill twice.

### Frontend

Use Playwright or similar to test:

- homepage still works;
- existing Cube Jump section still works;
- shop appears directly after Cube Jump;
- desktop product grid;
- mobile 2-column grid;
- cart;
- checkout form;
- payment screen;
- mocked payment success;
- access page;
- Start confirmation;
- active runtime;
- expired state.

Smoke-test all current simulation files inside the production runtime wrapper.

Check browser console for errors.

## 32. Local payment testing

Do not require real money transfers for the normal automated test suite.

Implement a secure development/test mechanism for simulating payment state locally.

This mechanism must be impossible to use in production.

For production validation, use SePay's official webhook testing capability before any optional real low-value payment smoke test.

Never add a hidden production "mark paid" public endpoint.

## 33. Deployment workflow

Work on the `master` branch source of truth, but avoid destroying production while implementing.

Prefer a safe development/preview workflow.

Before production deployment:

1. run migrations;
2. verify R2 imports;
3. verify all 35/current simulations;
4. verify admin Access;
5. verify Turnstile;
6. verify SePay HMAC webhook;
7. verify payment-code recognition;
8. verify mobile storefront;
9. verify access/expiration behavior;
10. verify no secrets are committed.

After the implementation is stable, deploy using the existing Cloudflare project/account rather than inventing an unrelated hosting stack.

Update README with:

- architecture;
- local development;
- migrations;
- product import;
- Cloudflare resource setup;
- required secret names;
- SePay setup;
- testing;
- deployment;
- operational recovery procedures.

## 34. Existing-site regression requirements

Do not break existing features.

Verify all existing functionality after the commerce implementation, including at minimum:

- desktop layout;
- mobile layout;
- theme switching;
- Cube Jump links/interactions;
- existing modals/popups;
- existing service/community/contact features;
- existing social links;
- copy buttons;
- local images/assets.

Do not rewrite unrelated sections merely for stylistic preference.

## 35. Operational behavior

Use explicit state machines rather than ambiguous booleans.

Server timestamps are authoritative.

Every important state transition should be safe under duplicate requests.

Prefer transactions/batches where D1 supports a reliable atomic workflow.

Use structured logs without secrets.

Important admin actions should create audit records containing:

- action;
- object type/id;
- timestamp;
- admin identity;
- before/after or useful metadata where appropriate.

## 36. Error handling

Customer errors should be understandable and not leak internals.

Admin errors should provide enough detail to operate the store.

Webhook processing errors must be logged sufficiently for reconciliation.

A failed notification or browser reload must never cause:

- duplicate entitlements;
- duplicate payments;
- extended runtime;
- duplicate order fulfillment.

## 37. Things you must not do

Do not:

- create customer accounts;
- require customer login;
- add coupons/promotions;
- store simulations publicly;
- trust frontend prices;
- trust frontend timer values;
- automatically refund money;
- expose secrets;
- store raw order access tokens;
- make a predictable payment code;
- use unauthenticated SePay production webhook;
- use browser localStorage as authorization;
- use IP address as the primary device identity;
- claim perfect DRM;
- deploy source maps for protected simulation JS;
- make a simulation permanently downloadable;
- generate 35 AI thumbnails when local screenshots work;
- move the site to a heavy frontend framework without a compelling technical requirement.

## 38. Decisions already approved by the owner

Do not ask the owner to reconfirm the following:

- default price: 10,000 VND;
- runtime: 15 minutes per purchased product;
- each product has an independent Start/timer;
- no pause/resume;
- expired products are locked and offer repurchase;
- activation deadline is desired;
- use the recommended default of 7 days;
- checkout identity is Gmail only;
- no customer login;
- access-link recovery is handled manually through admin support;
- payment QR expires after 15 minutes;
- payment prefix is BGZ with alphanumeric characters only;
- underpayment/overpayment require manual review;
- refunds are manual;
- there are no promotions;
- product cards require thumbnails;
- current local simulation directory is the import source;
- admin path is `/admin`;
- Cloudflare D1 + R2 + Workers are approved;
- production branch is `master`;
- strong source-code deterrence is required.

Only interrupt the owner when genuinely blocked by:

- missing login/session;
- OTP/2FA/human security verification;
- a required Cloudflare/SePay permission that is unavailable;
- an irreversible banking/security decision that cannot safely be inferred.

Otherwise make the technically safest reasonable decision and continue.

## 39. Execution order

Use this order:

0. Persist this specification and initialize the continuity/checkpoint files defined in Section 41.
1. Audit the entire repo.
2. Audit current simulation files.
3. Update obsolete project documentation.
4. Design and create D1 migrations.
5. Implement Worker/API foundation.
6. Create private R2 integration.
7. Create idempotent simulation import/versioning tool.
8. Generate local thumbnails.
9. Implement product/catalog APIs.
10. Implement storefront section.
11. Implement cart and Gmail checkout.
12. Add Turnstile and abuse controls.
13. Implement order/payment state model.
14. Implement SePay webhook with HMAC and idempotency.
15. Implement customer access-token flow.
16. Implement device binding.
17. Implement independent entitlement activation/timer.
18. Implement protected simulation runtime.
19. Implement practical anti-extraction transformations/watermarking.
20. Implement `/admin`.
21. Configure Cloudflare Access.
22. Configure D1/R2/Turnstile/secrets.
23. Configure SePay.
24. Run automated tests.
25. Test every simulation.
26. Test mobile and desktop.
27. Run production security checklist.
28. Deploy.
29. Perform production smoke tests.
30. Provide a concise final implementation report.

## 40. Final deliverables

Do not finish with only "implemented".

At completion provide:

- architecture summary;
- files added/changed;
- D1 database/migration summary;
- R2 bucket/import summary;
- number of imported products;
- number of successfully generated thumbnails;
- SePay configuration status;
- Cloudflare Access status;
- Turnstile status;
- test results;
- all 35/current simulation smoke-test results;
- security protections implemented;
- production deployment URL/routes;
- any manual security/OTP step that remains;
- any known limitation;
- exact commands for future product imports/migrations/deployment.

If anything failed, state exactly what failed and what remains, rather than hiding it.

The goal is a production-ready paid simulation storefront that feels like a natural extension of BinGenZ, is simple for anonymous customers to purchase from, is practical for one administrator to operate, and strongly protects paid simulation access without pretending that client-side code can provide perfect DRM.

## 41. Continuity, checkpoints, and context-loss recovery

This is a large multi-stage implementation that may span multiple Codex sessions, context compactions, quota resets, connection interruptions, or explicit `Continue` requests.

The project must therefore be recoverable entirely from the repository and actual infrastructure state.

Do not rely on conversation memory as the only source of implementation state.

### 41.1 Persist this specification inside the repository

At the beginning of the implementation, create:

`docs/commerce/IMPLEMENTATION_SPEC.md`

Copy the complete authoritative implementation specification from this prompt into that file without materially shortening, paraphrasing, or dropping requirements.

This repository copy becomes the durable implementation specification for future sessions.

If the owner later explicitly changes a requirement, update the repository copy and record the change in the decision log.

Never silently change requirements merely because a new session has less conversational context.

### 41.2 Create durable project-state files

Create and maintain:

- `docs/commerce/IMPLEMENTATION_SPEC.md`
- `docs/commerce/PROGRESS.md`
- `docs/commerce/DECISIONS.md`
- `docs/commerce/TEST_MATRIX.md`

These files are operational memory for Codex and must remain usable by a completely new session that has no knowledge of previous conversation history.

### 41.3 PROGRESS.md requirements

`docs/commerce/PROGRESS.md` must always contain at least:

- last updated timestamp;
- current implementation phase;
- current Git branch;
- current Git commit/checkpoint;
- last known production commit;
- completed milestones;
- currently in-progress work;
- exact next actions in priority order;
- blockers;
- actions requiring owner interaction;
- Cloudflare resources already created;
- D1 database name and binding names;
- R2 bucket name and binding names;
- Turnstile configuration status;
- Cloudflare Access configuration status;
- SePay configuration status;
- environment/secret variable names required, but NEVER secret values;
- migration status;
- product import status;
- number of simulations discovered;
- number of simulations successfully imported;
- number of thumbnails generated;
- automated test summary;
- simulation smoke-test summary;
- known defects;
- intentionally deferred work;
- relevant commands needed to resume;
- last safe rollback/checkpoint information.

Do not put passwords, API keys, HMAC secrets, access tokens, bank credentials, cookies, OTPs, or other sensitive values into this file.

### 41.4 DECISIONS.md requirements

Maintain:

`docs/commerce/DECISIONS.md`

Record non-trivial architectural or implementation decisions that future sessions must understand.

Each decision should contain:

- date/time;
- decision;
- reason;
- alternatives considered where relevant;
- consequences;
- affected files/resources.

Especially record any justified deviation from this specification.

Do not silently reinterpret the specification.

If actual infrastructure makes a requested implementation impossible, document the constraint and use the closest safe implementation consistent with the owner's intent.

### 41.5 TEST_MATRIX.md requirements

Maintain:

`docs/commerce/TEST_MATRIX.md`

Track:

- unit tests;
- integration tests;
- payment/webhook tests;
- security tests;
- storefront desktop tests;
- storefront mobile tests;
- admin tests;
- Cloudflare Access tests;
- Turnstile tests;
- SePay tests;
- every discovered simulation individually.

For every simulation include at minimum:

- filename;
- product/slug;
- imported status;
- thumbnail status;
- desktop test;
- mobile test;
- runtime-wrapper test;
- console-error status;
- minification/mangling compatibility;
- current known issues.

Do not report "all simulations tested" unless every current simulation appears individually in this matrix.

### 41.6 Git checkpoint strategy

Do not accumulate the entire project as one huge uncommitted change.

Use small, coherent checkpoint commits after meaningful milestones.

Unless the existing development environment already provides an equivalent safe task branch, create a dedicated implementation branch from the latest production `master`, for example:

`codex/commerce-storefront`

`master` remains the production source of truth.

Do not push incomplete experimental work directly into production.

Before beginning substantial work:

1. inspect `git status`;
2. inspect the current branch;
3. inspect recent commits;
4. preserve any legitimate existing user changes.

Never discard unknown changes simply because they were not created in the current session.

Do not use destructive commands such as:

- `git reset --hard`;
- forced checkout that discards changes;
- force push;
- destructive clean operations;

unless absolutely necessary and explicitly justified.

Before any risky infrastructure or deployment operation, create a recoverable checkpoint.

After every major implementation phase:

1. update `PROGRESS.md`;
2. update `DECISIONS.md` if needed;
3. update `TEST_MATRIX.md` if tests changed;
4. run the relevant tests;
5. create a Git checkpoint commit when the state is coherent.

Commit messages should describe the completed milestone rather than generic text such as "updates".

### 41.7 Milestone checkpoint boundaries

At minimum create durable state/checkpoints after:

1. repository audit;
2. architecture/database design;
3. D1 migrations;
4. Worker/API foundation;
5. R2 integration;
6. product import pipeline;
7. product import completion;
8. thumbnail generation;
9. storefront/catalog;
10. cart/checkout;
11. Turnstile/anti-abuse;
12. SePay webhook/payment matching;
13. customer access flow;
14. entitlement/timer implementation;
15. protected simulation runtime;
16. admin implementation;
17. Cloudflare Access configuration;
18. production infrastructure configuration;
19. automated testing;
20. complete simulation test pass;
21. pre-production verification;
22. production deployment;
23. post-deployment smoke testing.

A session interruption at any of these points must not require reconstructing completed work from conversation history.

### 41.8 Before long-running or risky operations

Before:

- large imports;
- mass file transformations;
- database migrations;
- R2 bulk uploads;
- SePay configuration changes;
- Cloudflare Access changes;
- production deployments;
- operations likely to consume substantial context or execution time;

update `PROGRESS.md` with the intended action and the last known safe checkpoint.

After the operation, immediately update its outcome.

### 41.9 Resume protocol after context loss or a new session

At the beginning of EVERY resumed or new Codex session, before modifying code:

1. read `docs/commerce/IMPLEMENTATION_SPEC.md` in full;
2. read `docs/commerce/PROGRESS.md`;
3. read `docs/commerce/DECISIONS.md`;
4. read `docs/commerce/TEST_MATRIX.md`;
5. inspect `git status`;
6. inspect the current branch;
7. inspect recent Git commits;
8. inspect relevant diffs;
9. verify the actual repository state;
10. verify relevant Cloudflare/SePay state when accessible;
11. compare documented progress against actual state;
12. repair stale progress documentation if necessary;
13. continue from the first incomplete required task.

Do not ask the owner to repeat requirements already stored in `IMPLEMENTATION_SPEC.md`.

Do not restart the project from the beginning merely because conversational context was lost.

Do not redo completed work unless verification shows it is incomplete, broken, stale, or incompatible with a later requirement.

### 41.10 Actual state beats stale progress notes

The authority order for implementation state is:

1. explicit current owner instructions;
2. `IMPLEMENTATION_SPEC.md`;
3. actual repository/code/database/infrastructure state;
4. `DECISIONS.md`;
5. `PROGRESS.md`;
6. previous conversational memory.

If `PROGRESS.md` says something is completed but the actual repository or infrastructure proves otherwise, correct the progress record and repair the implementation.

Never fabricate completion merely to match an old progress note.

### 41.11 Preserve unfinished work

If a session begins and finds uncommitted changes:

- inspect them;
- determine what they belong to;
- compare them with `PROGRESS.md`;
- test them where practical;
- continue or safely checkpoint them.

Never automatically delete unfinished work from a previous Codex session.

If partially implemented code is unsafe or broken, repair or isolate it instead of silently discarding it.

### 41.12 Idempotent operational tooling

Any tool that may need to be rerun after interruption should be designed to be safely repeatable.

This especially applies to:

- simulation import;
- thumbnail generation;
- D1 seeding;
- R2 uploads;
- product synchronization;
- migrations where practical;
- payment event processing.

A resumed session must be able to determine what already succeeded and continue without creating duplicate products, duplicate versions, duplicate uploads, duplicate orders, or duplicate entitlements.

### 41.13 No important knowledge may exist only in terminal output

If an implementation detail will be required by a future session, record it in the repository documentation.

Examples include:

- resource names;
- binding names;
- migration numbers;
- deployment commands;
- discovered infrastructure constraints;
- product-import conventions;
- unusual simulation compatibility fixes;
- provider configuration decisions;
- unresolved errors;
- manual steps still required.

Do not rely on terminal scrollback as durable project memory.

Never record secret values.

### 41.14 External infrastructure checkpoints

When creating or changing Cloudflare or SePay resources, record the non-sensitive outcome immediately.

For example record:

- D1 database logical name;
- R2 bucket logical name;
- Worker/service name;
- bindings;
- routes;
- Access application status;
- Turnstile site configuration status;
- SePay webhook status;
- payment-code rule status;
- whether configuration is development, preview, or production.

Never record credentials or secrets.

### 41.15 Human-intervention checkpoints

If progress stops because owner action is required, update `PROGRESS.md` BEFORE asking the owner.

Record:

- exactly what has already been completed;
- exactly what is blocked;
- the precise human action required;
- what Codex should verify immediately afterward;
- the next task to resume.

Examples include:

- Google login;
- Cloudflare authorization;
- SePay login;
- OTP;
- 2FA;
- bank/provider security confirmation.

After the owner completes the action, resume from that checkpoint rather than re-auditing or restarting unrelated work.

### 41.16 Context compaction rule

If Codex detects that the session is becoming long, context-heavy, or likely to be compacted:

1. finish the smallest currently safe unit of work;
2. update all relevant persistent state files;
3. run the applicable tests;
4. create a checkpoint commit if the state is coherent;
5. record the next exact action in `PROGRESS.md`;
6. then continue.

Never wait until context is already lost before recording state.

### 41.17 Quota or connection interruption rule

Assume that execution may stop unexpectedly at any time.

Keep the repository in a recoverable state throughout the implementation.

A future Codex session should be able to resume by reading the repository without needing access to previous chat messages.

### 41.18 Definition of a safe handoff

Before ending any session that has performed implementation work, ensure that:

- current work is saved;
- `PROGRESS.md` reflects reality;
- important decisions are documented;
- tests performed are recorded;
- blockers are recorded;
- the next concrete actions are recorded;
- no secret has been committed;
- the repository is left in a state understandable by another engineer.

The implementation should behave as if another senior engineer may take over at any moment.

## Owner session directive — 2026-09-17

The owner explicitly requested a safe handoff for this session: update all four Section 41 continuity files to reflect actual state, especially SePay progress, Cloudflare resources, blockers and exact next action; commit a coherent checkpoint; do not continue implementation after recording that checkpoint. This is a session stop instruction, not a change to the product requirements above. Future implementation resumes only on a subsequent owner instruction and follows Section 41.9. See PROGRESS.md for current handoff state.
