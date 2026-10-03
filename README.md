# BinGenZ website and commerce

Website và commerce Worker của `bingenz.com`, với giao diện HTML/CSS/JS trong `public/`, API trong `src/`, D1 và R2 riêng tư. Theo [đặc tả](docs/commerce/IMPLEMENTATION_SPEC.md) và xem [tiến độ](docs/commerce/PROGRESS.md) trước khi chỉnh sửa. Production đã chạy commerce; mọi release tiếp theo phải đi từ `master` qua đường triển khai Git đã xác minh.

## Giao diện cửa hàng và admin mới

Cửa hàng hiển thị toàn bộ sản phẩm. Admin có hai mục Đơn hàng và Sản phẩm; nhập vị trí hoặc dùng Lên/Xuống rồi Lưu thứ tự. Xem [cách dùng và kiểm tra](docs/commerce/ADMIN_SIMPLIFICATION.md).

## Kiến trúc và trạng thái

Worker `src/worker.mjs` phục vụ API/HTML của cửa hàng; D1 giữ sản phẩm, đơn, giao dịch, quyền sử dụng và audit; R2 riêng tư giữ bản gốc, bản giao cho người mua và ảnh quản trị tải lên. `public/` chỉ chứa giao diện và thumbnail công khai. Checkout cần Turnstile server-side; SePay webhook HMAC đối chiếu tiền vào, tài khoản, mã `BGZ`, số tiền và hạn 15 phút trước khi cấp quyền. Trang admin cần Cloudflare Access + kiểm tra JWT/email ở Worker. Quyền truy cập khách dùng token băm, cookie HttpOnly gắn thiết bị, Start độc lập và permit ngắn hạn. HTML gửi tới trình duyệt không thể là DRM tuyệt đối.

Preview tách biệt với production: `wrangler.preview.toml` trỏ tới D1/R2 `bingenz-commerce-preview`, đã nạp 35 sản phẩm và triển khai Worker tại `https://bingenz-commerce-preview.lnth.workers.dev`. Production `wrangler.toml` trỏ tới Worker/D1/R2 commerce thật và tuyệt đối không được chứa secret. Chạy `npm run test:preview` để smoke test preview không tạo đơn hay chuyển tiền.

## Xem giao diện static local

```bash
cd public
python -m http.server 4173
```

Mở `http://localhost:4173`.

## Cloudflare production hiện tại

Production dùng Worker `bingenz-web-static`, repository `bingenz/bingenz-web-static`:

- Build/deploy command: `npx wrangler deploy --config wrangler.toml`
- Root directory: repository root
- Production branch: `master`

Giữ domain `bingenz.com` và `www.bingenz.com`. Không đưa HTML mô phỏng trả phí vào `public/`, không đặt secret trong `wrangler.toml`, và không deploy nhánh phát triển trực tiếp lên production.

## Quy trình chỉnh sửa

1. Sửa file trong `public/`.
2. Nếu thay đổi `styles.css`, `commerce.css`, `app.js` hoặc `commerce.mjs`, **bắt buộc tăng cùng một cache-busting token** trong mọi thẻ `<link>`/`<script>` liên quan (ví dụ `?v=YYYYMMDD-N`). Không phát hành nội dung asset mới dưới URL cũ vì trình duyệt mobile có thể tiếp tục dùng giao diện đã cache.
3. Chạy local server và kiểm tra desktop/mobile, gồm CTA, SVG/icon, theme sáng/tối và tràn ngang.
4. Chạy test UI có kiểm tra token asset, kích thước CTA và màu icon. Khi sửa lỗi cache, phải kiểm tra lại bằng cùng một browser context đã từng mở bản cũ; không chỉ dựa vào cửa sổ ẩn danh hoặc browser sạch.
5. Kiểm tra các link, popup, theme và ảnh local.
6. Commit và push sau khi đã duyệt preview; smoke-test production và xác nhận HTML mới đang tham chiếu đúng token asset vừa phát hành.

## Commerce local development

Install pinned dependencies with `npm ci`. Copy `.dev.vars.example` to ignored `.dev.vars` and fill local-only values. Run `npm run migrate:local`, then `npm run dev`. Never deploy `wrangler.local.toml`. `npm test` runs unit and real workerd/D1/R2 integration tests with mocked external services; it makes no bank transfers. `npm run test:protected` verifies all 35 prepared simulations through a local paid entitlement at desktop/mobile (requires ignored prepared product files).

Use explicit config files for every Wrangler operation. `npm run migrate:preview` targets only the isolated preview D1; `npm run deploy:preview` targets only the separate preview Worker. Neither command is a production release. Review remote bindings and secrets before deployment. Do not use the old generic `wrangler deploy` or `wrangler d1 migrations apply ... --remote` without a verified config. A failed migration must be inspected before retrying; do not edit already-applied migration SQL in production.

Required secret names: `SESSION_SECRET`, `ABUSE_HASH_KEY`, `SEPAY_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_NAME`. Non-secret configuration: `BANK_CODE`, `ADMIN_EMAIL`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `TURNSTILE_SITE_KEY`, `TURNSTILE_HOSTNAMES`. Bindings: `DB`, `SIMULATIONS`, `ASSETS`. Set secrets through the Cloudflare secret mechanism for the exact target Worker, never in Git or public assets. The `.dev.vars.example` values are placeholders, not usable credentials.

## Product preparation and import

1. `node scripts/prepare-products.mjs C:/Users/Acer/Downloads/QuickShare_2609122051` scans all current HTML, minifies conservatively, captures real simulation WebP thumbnails and writes an ignored private manifest.
2. Apply local migrations as above, then `node scripts/import-products.mjs` for local private R2 and D1.
3. Remote import (only after resource provisioning): `node scripts/import-products.mjs --remote --config <verified-config.toml> --bucket <private-bucket>`.

Repeated imports preserve seller metadata and existing version history. New source hashes select a new version; rerunning identical source preserves an administrator's rollback. Never publish `.private/` or original HTML. Thumbnails alone belong in `public/product-thumbnails/`.
Run `npm run audit:preview-r2` to read back every original/delivery object from the isolated preview bucket and compare its size and SHA-256 against the private manifest. This is read-only on Cloudflare and uses temporary local files.

## SePay và release

Webhook BinGenZ #57962 dùng URL production `/api/webhook/sepay` (số ít), HMAC-SHA256, TPBank, retry và cảnh báo lỗi. Worker chỉ ghi giao dịch thật có ID dương; payload `Gửi thử` đã ký với ID `0` được xác thực nhưng không ghi D1 hay cấp quyền. SePay phải đồng bộ cả từ khóa `BGZ`, và mẫu nhận diện phải là đúng 12 ký tự chữ/số. Không thay đổi webhook Cube Jump. QR proxy dùng tài khoản từ secret và mã `BGZ` làm nội dung chuyển khoản. Không chuyển tiền hoặc hoàn tiền tự động trong kiểm thử.

Trước production release: xác minh migration, mọi object R2 và 35 mô phỏng, Access/Google và JWT live, Turnstile token thật/replay, SePay HMAC và nhận diện BGZ, QR/payment đúng hạn/sai hạn, giao diện mobile, hết hạn quyền, không có secret trong Git. Chỉ khi đó mới cập nhật cấu hình Worker production hiện có, triển khai và smoke test domain thật. Xem [ma trận](docs/commerce/TEST_MATRIX.md) để biết bằng chứng và ca còn thiếu.

## Vận hành và khôi phục

Tra đơn/giao dịch bằng Gmail, ID, mã BGZ, SePay reference hoặc sản phẩm trong `/admin`; giao dịch thiếu/thừa/sai mã/trễ phải được xem xét thủ công, không tự cấp quyền. Sau khi xác minh khách ngoài hệ thống, admin có thể ghi support note, cấp lại liên kết (vô hiệu liên kết/cookie cũ), reset thiết bị nếu cần, hoặc gia hạn/mở lại quyền có audit. Hoàn tiền được ghi nhận trong admin nhưng chuyển khoản phải thực hiện thủ công bên ngoài hệ thống. Nếu nạp sản phẩm bị ngắt, chạy lại importer với cùng manifest; nó có marker phục hồi và không xóa version cũ. Nếu bản HTML mới lỗi, chọn version trước trong admin thay vì xóa R2. Với sự cố release, dừng thay đổi provider, xác minh deployment/config/bindings hiện tại và dùng version Worker trước; giữ D1/R2 để không mất đơn/quyền. Không rollback schema bằng cách xóa dữ liệu.

## Admin product maintenance (local implementation)

The `/admin` UI requires a valid Cloudflare Access JWT for the configured owner; a live Access application is still pending. New products start inactive. To add or replace paid HTML, run `npm run prepare:admin-upload -- <trusted-simulation.html>` locally. Review the simulation and select the resulting ignored `.private/admin-upload/*.json` package in the admin UI for the chosen product. The Worker verifies package hashes, writes original/delivery objects to private R2, then records a version and audit entry in D1. Uploading does not activate a draft; turn it on deliberately after checking its version and thumbnail. Do not send the package to a public asset directory or commit it. A WebP thumbnail (maximum 1 MiB) can be replaced separately from the admin UI.

Products are sold directly from the `#store` section on the homepage; `/shop` and `/shop/<slug>` intentionally return 404, while checkout remains at `/checkout`. The homepage shows every matching product with lazy-loaded images, client-side search, category filters and sorting. The default order is maintained in Admin → Sản phẩm using positions and Up/Down controls, then saved atomically. Seller copy in `docs/commerce/PRODUCT_METADATA.json` remains reference data; the removed metadata import UI is no longer an operational step.

## Gemini Pro storefront

`#gemini-pro` appears between Cube Jump and the simulation store. `public/gemini.mjs` handles plan selection, a native accessible checkout dialog, shared Turnstile verification, QR/status polling and Zalo support. The supplied Gemini/Antigravity SVGs live in `public/icons/`. The premium card supports reduced-motion preferences. Only the last order ID is stored in localStorage; the existing HttpOnly checkout cookie remains required to view its payment details.

Release initialization applies **`0007_gemini_orders.sql` atomically through the Worker’s existing D1 binding** before serving Gemini plans, order APIs or authenticated admin operations. It records the migration in `d1_migrations`, handles concurrent isolates, and refuses unknown/partial schemas. This requires no additional Cloudflare token in the editing environment. Applying the migration through Wrangler first is also supported and becomes a no-op at runtime. The additive migration seeds five Gemini plans and adds order type and immutable plan snapshots. Existing simulation validation and snapshots remain scoped to simulations. Gemini uses the same TPBank secrets, BGZ payment codes, signed SePay webhook, 15-minute payment window and admin order/payment records. It never creates a simulation entitlement. Successful payment instructs the buyer to send the order code to Zalo **0898908101** for manual delivery or upgrade. No password is collected and no delivery-time promise is displayed.

Prices: account 1/3/6 months = 79,000/219,000/399,000 VND; personal upgrade 12/18 months = 995,000/1,299,000 VND. `gemini_plans` is authoritative at checkout; any later price change must also update the visible defaults in `index.html` and `gemini.mjs`. Keep price values as integer VND. Use Admin → Đơn hàng to search by Gmail/payment code, inspect the snapshotted plan, and record delivery details with support notes. Gemini orders do not offer simulation access-link reissue.

Validation: `npm test` includes signed SePay integration fixtures for all five plans, invalid amounts/bank/time/direction, order ownership, duplicate webhook handling and no simulation fulfillment. Gemini browser tests cover desktop/mobile, both themes, term selection, copy actions, checkout, paid/expired states, resume and reduced motion. Screenshots are generated under ignored `test-results/gemini/`. These tests mock the external payment and Turnstile services; they do not transfer real money or verify live production provider configuration.
