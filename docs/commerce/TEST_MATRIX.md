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
| 01-a-star-pathfinding.html | 01-a-star-pathfinding | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 02-quick-sort.html | 02-quick-sort | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 03-lru-cache.html | 03-lru-cache | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 04-dns-resolution.html | 04-dns-resolution | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 05-load-balancer.html | 05-load-balancer | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 06-rate-limiting.html | 06-rate-limiting | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 07-deadlock-detection.html | 07-deadlock-detection | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 08-jwt-authentication.html | 08-jwt-authentication | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 09-k-means-clustering.html | 09-k-means-clustering | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 10-blockchain-mining.html | 10-blockchain-mining | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 11-binary-search.html | 11-binary-search | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 12-merge-sort.html | 12-merge-sort | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 13-breadth-first-search.html | 13-breadth-first-search | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 14-depth-first-search.html | 14-depth-first-search | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 15-dijkstra-shortest-path.html | 15-dijkstra-shortest-path | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 16-hash-table-collision.html | 16-hash-table-collision | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 17-bloom-filter.html | 17-bloom-filter | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 18-trie-autocomplete.html | 18-trie-autocomplete | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 19-producer-consumer.html | 19-producer-consumer | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 20-message-queue-retry.html | 20-message-queue-retry | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 21-tcp-handshake.html | 21-tcp-handshake | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 22-cdn-cache.html | 22-cdn-cache | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 23-sql-transaction-locking.html | 23-sql-transaction-locking | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 24-garbage-collection-mark-sweep.html | 24-garbage-collection-mark-sweep | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 25-memory-paging-lru.html | 25-memory-paging-lru | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 26-cpu-round-robin.html | 26-cpu-round-robin | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 27-union-find.html | 27-union-find | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 28-topological-sort.html | 28-topological-sort | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 29-consistent-hashing.html | 29-consistent-hashing | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| 30-raft-leader-election.html | 30-raft-leader-election | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| battery-charge-animation-tiktok-9x16-v4.html | battery-charge-animation-tiktok-9x16-v4 | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| database-index-tiktok-pro.html | database-index-tiktok-pro | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| ddos-simulation-tiktok-pro.html | ddos-simulation-tiktok-pro | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| fingerprint-sim-tiktok-pro.html | fingerprint-sim-tiktok-pro | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |
| object-detection-tiktok-pro-v2.html | object-detection-tiktok-pro-v2 | No | No | Pending | Pending | Pending | Pending | Pending | Syntax and baseline load/initial run pass; protected full-cycle test pending |

