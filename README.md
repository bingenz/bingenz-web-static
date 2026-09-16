# BinGenZ static site

Website của `bingenz.com`, với giao diện HTML/CSS/JS trong `public/`. Commerce đang được triển khai trên nhánh `codex/commerce-storefront`, theo [đặc tả](docs/commerce/IMPLEMENTATION_SPEC.md). Xem [tiến độ và hướng dẫn tiếp tục](docs/commerce/PROGRESS.md) trước khi chỉnh sửa.

## Xem local

```bash
cd public
python -m http.server 4173
```

Mở `http://localhost:4173`.

## Cloudflare Workers

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

## Commerce local development (implementation branch)

Install pinned dependencies with `npm ci`. Copy `.dev.vars.example` to ignored `.dev.vars` and configure local credentials. Run `npx wrangler d1 migrations apply DB --local --config wrangler.local.toml`, then `npx wrangler dev --config wrangler.local.toml`. Never deploy this local configuration. `npm test` runs unit and real workerd/D1 integration tests with isolated in-memory fixtures and mocked provider responses; it makes no bank transfers. The production configuration remains unchanged until the release gates pass.

## Product preparation and import

1. `node scripts/prepare-products.mjs C:/Users/Acer/Downloads/QuickShare_2609122051` scans all current HTML, minifies conservatively, captures real simulation WebP thumbnails and writes an ignored private manifest.
2. Apply local migrations as above, then `node scripts/import-products.mjs` for local private R2 and D1.
3. Remote import (only after resource provisioning): `node scripts/import-products.mjs --remote --config <verified-config.toml> --bucket <private-bucket>`.

Repeated imports preserve seller metadata and existing version history. New source hashes select a new version; rerunning identical source preserves an administrator's rollback. Never publish `.private/` or original HTML. Thumbnails alone belong in `public/product-thumbnails/`.
