# Public browsing and Cloudflare challenges

Production inspection on 2026-11-06 found `security_level=medium`, Browser Integrity Check enabled, and an enabled custom Managed Challenge rule `0b7a2b2b37584f4a8df8283f9a4de4ba`. The last-24-hour firewall-event sample contained 70 Managed Challenge events from this custom rule. Under Attack mode was not enabled. The existing rate-limit rule remains active.

The manually dispatched **Manage Cloudflare entry challenges** workflow uses the repository Actions secret `CLOUDFLARE_API_TOKEN`. Its default `audit` operation reads settings and aggregates firewall events without logging tokens, rule expressions, visitor IPs or request URLs. Some optional endpoints may be unavailable with a narrowly scoped token.

The `apply` operation appends a precise exclusion to only the identified challenge rule. It covers GET/HEAD on bingenz.com and www.bingenz.com for the homepage, explicit public CSS/JS files, icons/images/public thumbnails and public catalog/plan APIs. The rule's original expression and all other rules/settings remain intact. Order creation, pending-order lookup, QR/payment, checkout, access and admin routes are not excluded. Application Turnstile, order rate limits and admin authentication are unchanged.

The operation verifies the rule identity/action, checks for intervening edits, patches only the target expression and compares all rules after the update. It is idempotent. `rollback` removes only its recognized wrapper and restores the original expression; it refuses an unrecognized rule or expression. Before/after hashes are logged for review, but no raw expressions are logged.

To operate: run the workflow on `master` with `operation=audit`, `apply` or `rollback`. After applying, verify the API result and test the homepage/public catalogs in fresh desktop/mobile browser sessions. Protection against a future attack or an unrelated Cloudflare rule can still cause challenges; this exception does not disable Cloudflare security globally.
