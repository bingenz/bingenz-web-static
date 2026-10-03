# Gemini storefront release

Adds two cards after Cube Jump: supplied accounts (1/3/6 months) and premium personal upgrades (12/18 months). Uses the two supplied SVG designs. Warranty and Antigravity model copy are seller-provided. Payment uses the existing bank destination and SePay webhook; delivery and upgrades are handled via Zalo.

## Deployment order

1. Review desktop/mobile screenshots and the feature branch diff. Run `npm test`.
2. Verify the selected production Worker and D1 binding. `src/gemini-schema.mjs` applies the bundled `0007_gemini_orders.sql` through the existing D1 binding before requests can use the new schema. DDL and the standard `d1_migrations` marker commit in one atomic batch. Concurrent isolates recheck the full schema after a competing batch; unknown/partial schemas fail closed. A database already migrated by Wrangler is left unchanged. Do not deploy the local config.
3. For production, use the existing reviewed master/Git release process; do not deploy the feature branch directly to production. Assets use token `20261003-1`.
4. Request `/api/gemini/plans` to initialize/verify the migration and confirm it returns five plans; check plan selections and both themes. Verify real Turnstile works for the intended hostname, QR shows the existing bank account, and the payment screen opens with the correct selected amount. Live provider/payment checks remain a release step; tests only use signed local fixtures.
5. Verify an authorized paid Gemini order appears in Admin with its plan and the customer sees Zalo instructions rather than simulation access. Record manual delivery in the order's support notes.

## Scope and rollback

No provider configuration, bank secrets, production data or Cloudflare resources were changed during implementation. No real payments were sent. SePay matching logic is unchanged. Gemini prices are server-authoritative and snapshot into orders. Migration does not modify existing orders' business data or simulation product prices.

If rollback is necessary, retain D1 tables/order records. An old application version does not understand Gemini fulfillment, so disable Gemini sales and inspect outstanding Gemini orders before reverting application code. Do not remove migration columns or delete paid orders. Do not send Gemini customers through the simulation claim/access flow.

## Release initialization validation

The initialization uses fixed, reviewed SQL; it does not accept SQL, schema names or credentials from HTTP requests. Public catalog, existing payment webhook and static assets do not require initialization. Tests exercise simultaneous cold starts, a failure after DDL followed by rollback/retry, partial-schema refusal, CLI-preapplied migration, and continued fulfillment of an existing simulation order. The bundled JSON is compared exactly against the SQL split by Wrangler in tests.
