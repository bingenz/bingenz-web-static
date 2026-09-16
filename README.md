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
