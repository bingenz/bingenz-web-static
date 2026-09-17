# BinGenZ website and commerce

Website của `bingenz.com`, với giao diện HTML/CSS/JS trong `public/`. Commerce đang được triển khai trên nhánh `codex/commerce-storefront`, theo [đặc tả](docs/commerce/IMPLEMENTATION_SPEC.md). Xem [tiến độ và hướng dẫn tiếp tục](docs/commerce/PROGRESS.md) trước khi chỉnh sửa. Production chưa nhận mã commerce của nhánh này.

## Kiến trúc và trạng thái

Worker `src/worker.mjs` phục vụ API/HTML của cửa hàng; D1 giữ sản phẩm, đơn, giao dịch, quyền sử dụng và audit; R2 riêng tư giữ bản gốc, bản giao cho người mua và ảnh quản trị tải lên. `public/` chỉ chứa giao diện và thumbnail công khai. Checkout cần Turnstile server-side; SePay webhook HMAC đối chiếu tiền vào, tài khoản, mã `BGZ`, số tiền và hạn 15 phút trước khi cấp quyền. Trang admin cần Cloudflare Access + kiểm tra JWT/email ở Worker. Quyền truy cập khách dùng token băm, cookie HttpOnly gắn thiết bị, Start độc lập và permit ngắn hạn. HTML gửi tới trình duyệt không thể là DRM tuyệt đối.

Preview tách biệt với production: `wrangler.preview.toml` trỏ tới D1/R2 `bingenz-commerce-preview`, đã nạp 35 sản phẩm; preview Worker và các secret chưa triển khai. `wrangler.toml` hiện vẫn là Worker static production cũ. Không chạy lệnh deploy production cho đến khi các cổng ở mục 33 của đặc tả đều qua.

## Xem giao diện static local

```bash
cd public
python -m http.server 4173
```

Mở `http://localhost:4173`.

## Cloudflare production hiện tại

Production dùng Worker hiện có `bingenz-web-static`, repository `bingenz/bingenz-web-static`:

- Build command: để trống
- Build output directory: `public`
- Production branch: `master`

Giữ domain `bingenz.com` và `www.bingenz.com`. Kiến trúc commerce dùng Workers, D1, R2 riêng tư, Cloudflare Access + Google, Turnstile và SePay. Không đưa HTML mô phỏng trả phí vào `public/`. Không deploy nhánh đang phát triển trước khi hoàn tất các bước xác minh trong đặc tả.

## Quy trình chỉnh sửa

1. Sửa file trong `public/`.
2. Chạy local server và kiểm tra desktop/mobile.
3. Kiểm tra các link, popup, theme và ảnh local.
4. Commit và push sau khi đã duyệt preview.

## Commerce local development

Install pinned dependencies with `npm ci`. Copy `.dev.vars.example` to ignored `.dev.vars` and fill local-only values. Run `npm run migrate:local`, then `npm run dev`. Never deploy `wrangler.local.toml`. `npm test` runs unit and real workerd/D1/R2 integration tests with mocked external services; it makes no bank transfers. `npm run test:protected` verifies all 35 prepared simulations through a local paid entitlement at desktop/mobile (requires ignored prepared product files).

Use explicit config files for every Wrangler operation. `npm run migrate:preview` targets only the isolated preview D1; `npm run deploy:preview` targets only the separate preview Worker. Neither command is a production release. Review remote bindings and secrets before deployment. Do not use the old generic `wrangler deploy` or `wrangler d1 migrations apply ... --remote` without a verified config. A failed migration must be inspected before retrying; do not edit already-applied migration SQL in production.

Required secret names: `SESSION_SECRET`, `ABUSE_HASH_KEY`, `SEPAY_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `BANK_ACCOUNT_NUMBER`. Non-secret configuration: `BANK_CODE`, `ADMIN_EMAIL`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `TURNSTILE_SITE_KEY`, `TURNSTILE_HOSTNAMES`. Bindings: `DB`, `SIMULATIONS`, `ASSETS`. Set secrets through the Cloudflare secret mechanism for the exact target Worker, never in Git or public assets. The `.dev.vars.example` values are placeholders, not usable credentials.

## Product preparation and import

1. `node scripts/prepare-products.mjs C:/Users/Acer/Downloads/QuickShare_2609122051` scans all current HTML, minifies conservatively, captures real simulation WebP thumbnails and writes an ignored private manifest.
2. Apply local migrations as above, then `node scripts/import-products.mjs` for local private R2 and D1.
3. Remote import (only after resource provisioning): `node scripts/import-products.mjs --remote --config <verified-config.toml> --bucket <private-bucket>`.

Repeated imports preserve seller metadata and existing version history. New source hashes select a new version; rerunning identical source preserves an administrator's rollback. Never publish `.private/` or original HTML. Thumbnails alone belong in `public/product-thumbnails/`.
Run `npm run audit:preview-r2` to read back every original/delivery object from the isolated preview bucket and compare its size and SHA-256 against the private manifest. This is read-only on Cloudflare and uses temporary local files.

## SePay và release

Webhook BinGenZ #56829 đang lưu URL production `/api/webhook/sepay` (số ít), HMAC-SHA256 và tài khoản TPBank được chọn. Chưa đối chiếu secret với Worker, chưa gửi thử chính thức. Cấu hình nhận diện mã hiện chỉ có `CJ`/`MP`; cần thêm mẫu `BGZ` + 12 ký tự chữ/số sau khi endpoint và HMAC sẵn sàng. Không thay đổi webhook Cube Jump. QR proxy dùng tài khoản từ secret và mã `BGZ` làm nội dung chuyển khoản. Không chuyển tiền hoặc hoàn tiền tự động trong kiểm thử.

Trước production release: xác minh migration, mọi object R2 và 35 mô phỏng, Access/Google và JWT live, Turnstile token thật/replay, SePay HMAC và nhận diện BGZ, QR/payment đúng hạn/sai hạn, giao diện mobile, hết hạn quyền, không có secret trong Git. Chỉ khi đó mới cập nhật cấu hình Worker production hiện có, triển khai và smoke test domain thật. Xem [ma trận](docs/commerce/TEST_MATRIX.md) để biết bằng chứng và ca còn thiếu.

## Vận hành và khôi phục

Tra đơn/giao dịch bằng Gmail, ID, mã BGZ, SePay reference hoặc sản phẩm trong `/admin`; giao dịch thiếu/thừa/sai mã/trễ phải được xem xét thủ công, không tự cấp quyền. Sau khi xác minh khách ngoài hệ thống, admin có thể ghi support note, cấp lại liên kết (vô hiệu liên kết/cookie cũ), reset thiết bị nếu cần, hoặc gia hạn/mở lại quyền có audit. Hoàn tiền được ghi nhận trong admin nhưng chuyển khoản phải thực hiện thủ công bên ngoài hệ thống. Nếu nạp sản phẩm bị ngắt, chạy lại importer với cùng manifest; nó có marker phục hồi và không xóa version cũ. Nếu bản HTML mới lỗi, chọn version trước trong admin thay vì xóa R2. Với sự cố release, dừng thay đổi provider, xác minh deployment/config/bindings hiện tại và dùng version Worker trước; giữ D1/R2 để không mất đơn/quyền. Không rollback schema bằng cách xóa dữ liệu.

## Admin product maintenance (local implementation)

The `/admin` UI requires a valid Cloudflare Access JWT for the configured owner; a live Access application is still pending. New products start inactive. To add or replace paid HTML, run `npm run prepare:admin-upload -- <trusted-simulation.html>` locally. Review the simulation and select the resulting ignored `.private/admin-upload/*.json` package in the admin UI for the chosen product. The Worker verifies package hashes, writes original/delivery objects to private R2, then records a version and audit entry in D1. Uploading does not activate a draft; turn it on deliberately after checking its version and thumbnail. Do not send the package to a public asset directory or commit it. A WebP thumbnail (maximum 1 MiB) can be replaced separately from the admin UI.
