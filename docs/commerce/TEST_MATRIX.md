# Verification matrix

Baseline syntax and browser smoke checks have run. Pending is not a pass; baseline is not production runtime validation.

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

Inventory complete: 35 originals. Each passed desktop/mobile baseline loading and initial interaction; screenshots are local audit evidence, not product thumbnails.
Required columns: filename, product/slug, imported, thumbnail, desktop, mobile, runtime wrapper, console errors, minification/mangling, known issues.

| Filename | Product / proposed slug | Imported | Thumbnail | Desktop | Mobile | Wrapper | Console | Minification | Issues |
|---|---|---|---|---|---|---|---|---|---|
| 01-a-star-pathfinding.html | 01-a-star-pathfinding | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 02-quick-sort.html | 02-quick-sort | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 03-lru-cache.html | 03-lru-cache | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 04-dns-resolution.html | 04-dns-resolution | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 05-load-balancer.html | 05-load-balancer | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 06-rate-limiting.html | 06-rate-limiting | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 07-deadlock-detection.html | 07-deadlock-detection | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 08-jwt-authentication.html | 08-jwt-authentication | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 09-k-means-clustering.html | 09-k-means-clustering | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 10-blockchain-mining.html | 10-blockchain-mining | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 11-binary-search.html | 11-binary-search | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 12-merge-sort.html | 12-merge-sort | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 13-breadth-first-search.html | 13-breadth-first-search | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 14-depth-first-search.html | 14-depth-first-search | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 15-dijkstra-shortest-path.html | 15-dijkstra-shortest-path | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 16-hash-table-collision.html | 16-hash-table-collision | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 17-bloom-filter.html | 17-bloom-filter | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 18-trie-autocomplete.html | 18-trie-autocomplete | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 19-producer-consumer.html | 19-producer-consumer | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 20-message-queue-retry.html | 20-message-queue-retry | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 21-tcp-handshake.html | 21-tcp-handshake | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 22-cdn-cache.html | 22-cdn-cache | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 23-sql-transaction-locking.html | 23-sql-transaction-locking | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 24-garbage-collection-mark-sweep.html | 24-garbage-collection-mark-sweep | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 25-memory-paging-lru.html | 25-memory-paging-lru | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 26-cpu-round-robin.html | 26-cpu-round-robin | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 27-union-find.html | 27-union-find | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 28-topological-sort.html | 28-topological-sort | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 29-consistent-hashing.html | 29-consistent-hashing | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 30-raft-leader-election.html | 30-raft-leader-election | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| battery-charge-animation-tiktok-9x16-v4.html | battery-charge-animation-tiktok-9x16-v4 | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| database-index-tiktok-pro.html | database-index-tiktok-pro | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| ddos-simulation-tiktok-pro.html | ddos-simulation-tiktok-pro | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| fingerprint-sim-tiktok-pro.html | fingerprint-sim-tiktok-pro | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| object-detection-tiktok-pro-v2.html | object-detection-tiktok-pro-v2 | Local yes; remote no | Yes | Pending | Pending | Pending | Pending | Initial load pass | Syntax and baseline load/initial run pass; protected full-cycle test pending |


## Foundation checkpoint — 2026-09-17

13 automated tests pass (npm test): SQLite constraints; Gmail/code/session/HMAC/body validation; real workerd/D1 router, server prices, inactive/duplicate cart rejection, pending reuse and ownership, Turnstile wrong host/action and replay, concurrent duplicate payment with two independent entitlements. Provider Siteverify is mocked only in the test harness outbound binding. Live Turnstile/SePay tests remain pending. Admin currently fails closed pending implementation/configuration.

## Local import verification — 2026-09-17

35/35 local products and versions imported twice without duplication; 35 WebP thumbnails generated. Remote import remains pending. Minified files loaded in browser during thumbnail capture; complete desktop/mobile minification compatibility and protected full-cycle tests remain pending. 17 automated tests now pass including import interruption/rollback and access/device/atomic Start/R2/mismatch payment tests.

