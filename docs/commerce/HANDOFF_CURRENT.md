# Current commerce release handoff

- Checkpoint: `2026-09-25`, production source commit `b6f9fb3` on `master`, Cloudflare version `96183fb8-f182-4fcf-9226-98486a7fdf07` receiving 100% traffic.
- Current patch: make the mobile hero CTA and Cube Jump web CTA compact, force the GitHub SVG to follow the active theme, and version public CSS/JS URLs with `?v=20260925-2` so existing mobile browsers cannot retain the broken cached UI.
- Verification: 40/40 Node tests pass. Local visual checks at 360/390/430 px measure the hero CTA at 44 px high, the game CTA at 210 × 44 px, the dark-theme GitHub fill as `rgb(241, 245, 249)`, and no horizontal overflow.
- Release path: commit reviewed files, excluding `.codex-remote-attachments/`, `.wrangler-dry-run/` and the pre-existing root handoff file; push `master`; wait for the Git-triggered Cloudflare version; then verify the production asset token and rerun mobile smoke tests.
- Rollback target before this patch: Git commit `b6f9fb3` / Cloudflare version `96183fb8-f182-4fcf-9226-98486a7fdf07`. Do not modify D1/R2 to roll back a presentation-only patch.

## Mandatory UI cache rule

Never deploy changed `styles.css`, `commerce.css`, `app.js` or `commerce.mjs` while keeping their previous public URL. Increment one release token such as `?v=YYYYMMDD-N` in every HTML reference, keep the token consistent across that release, and add or update a test that asserts the new token. A clean Playwright/incognito session is not sufficient evidence: also validate the reload path for a browser that opened the previous release. This rule exists because stale mobile assets previously kept an oversized CTA and a black GitHub icon visible after the source had already been fixed.
