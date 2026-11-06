# ChatGPT Plus

The AI section shows ChatGPT Plus first, then the two existing Gemini cards. ChatGPT Plus is a supplied private account for one month, initially 390,000 VND, with the supplied OpenAI SVG and the badge “Bảo hành full”. No additional warranty or feature claims are displayed. Delivery is manual via the existing Zalo contact after QR payment.

## Data and API compatibility

Migration `0008_ai_products.sql` adds `product_family` to the existing manually delivered plan and order storage. ChatGPT uses plan ID `chatgpt-plus-1`. Existing records default to Gemini; historical titles and prices are preserved. Internal `kind='gemini'`, the `gemini_*` snapshot columns and cart prefix remain the legacy manual-delivery storage format for both providers. They must not be interpreted as a customer-facing product name. The family is copied from the server's plan and checked by a database trigger on insertion. Both families remain excluded from simulation fulfillment and access claims.

- `GET /api/ai/plans` returns active plans from both families and the existing Turnstile site key.
- `GET /api/ai/pending?plan_id=…` resumes the selected cookie-owned pending plan.
- Existing Gemini catalog and pending endpoints remain scoped to Gemini.
- `POST /api/orders` continues to accept `gmail`, `plan_id` and `turnstile_token`; clients cannot supply the product family or price. Manual order responses include `product_family`.
- Authenticated `GET/PATCH /admin/api/ai-prices` manages all six plans using the existing atomic price updates, snapshot conflict detection and validation. Changes write `ai.prices.update` audit entries. The legacy Gemini editor API still manages only its five plans.

## Visual preview

- [Desktop, light](chatgpt-preview/desktop-light.png)
- [Desktop, dark](chatgpt-preview/desktop-dark.png)
- [Mobile, light](chatgpt-preview/mobile-light.png)

## Review and release

Run `npm ci`, `npx playwright install chromium`, then `npm test`. Browser checks save responsive light/dark AI-card screenshots in `test-results/gemini/` and price-editor screenshots in `test-results/admin-gemini-prices/`. Worker fixtures exercise ChatGPT payment and fulfillment without sending real payments.

For local review, run `npm run migrate:local` followed by `npm run dev`. Catalog prices are available locally; real checkout requires the environment's payment, abuse-protection and Turnstile configuration. Do not configure production credentials merely for a visual review.

Production deployment remains a separate reviewed step through the repository's existing release process. The Worker initializes migration 0008 atomically through the existing D1 binding, after ensuring migration 0007. It supports concurrent cold starts and CLI-preapplied migrations, refuses partial schema state, and does not overwrite later admin price changes. Public/admin assets use release token `20261106-2`.

Before a production release, verify the intended Worker/D1 binding, configured hostname and Turnstile, the existing bank destination, and one authorized payment-to-Zalo flow. No production resources, credentials or live payment data were changed during development.

For rollback, retain the migration and order records. Disable the ChatGPT plan before reverting application code, and handle outstanding ChatGPT orders using their stored family/title and support notes: older UI versions label all legacy manual orders as Gemini. Never remove paid order records or route manually delivered orders into simulation access.


## Compact cards

Cards now show only the icon, product name, account type, warranty badge, server price/term, Gemini duration choices and Buy button. The fixed ChatGPT duration is shown next to its price. Introductory text, repeated delivery notes, monthly conversions and savings labels were removed from the cards. Product details are available in a native, keyboard-accessible disclosure below the shared QR/Zalo note. The premium Gemini appearance is retained.

Current preview: [desktop](chatgpt-preview/compact-desktop-light.png), [mobile](chatgpt-preview/compact-mobile-light.png), [desktop dark](chatgpt-preview/compact-desktop-dark.png), [mobile dark](chatgpt-preview/compact-mobile-dark.png). Captured from the local Worker with the actual local catalog. Desktop cards are 360px tall, with aligned Buy buttons; mobile cards are 259–347px tall. Neither viewport has horizontal overflow.
