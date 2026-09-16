# Agent Rules

## Project scope

- This repository is a plain static site for `bingenz.com`.
- Source of truth is `public/`; deploy `public/` directly with Cloudflare Pages.
- Do not add product catalogs, checkout, authentication, admin tools, APIs, Functions, databases, KV bindings, or payment integrations.

## UI rules

- Preserve the current BinGenZ visual language and layout unless the user explicitly asks for a redesign.
- Keep the existing service, community, Cube Jump, contact, theme, and social-link flows working.
- Use shared CSS in `public/styles.css`; avoid new frameworks or build systems.

## Verification

- Serve `public/` locally after every visible change.
- Check desktop and mobile layouts, theme toggle, Cube Jump link, service modal, community popup, QR links, and copy buttons.
- Confirm there are no broken local asset references and no backend/API requests.
- Do not push automatically without explicit user approval.
