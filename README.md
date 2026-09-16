# BinGenZ static site

Website tĩnh của `bingenz.com`, với nguồn trong `public/`. Trang giữ lại các phần giới thiệu BinGenZ, Cube Jump, dịch vụ, cộng đồng và liên hệ; không có tài khoản, sản phẩm trả phí, thanh toán, API hoặc database.

## Xem local

```bash
cd public
python -m http.server 4173
```

Mở `http://localhost:4173`.

## Cloudflare Pages

Kết nối repository với Cloudflare Pages bằng các thiết lập:

- Build command: để trống
- Build output directory: `public`
- Production branch: `main`

Giữ zone DNS `bingenz.com`, sau đó gắn `bingenz.com` và `www` vào Pages project tĩnh mới. Không cần Wrangler, Functions, D1, KV, Google OAuth hoặc SePay.

## Quy trình chỉnh sửa

1. Sửa file trong `public/`.
2. Chạy local server và kiểm tra desktop/mobile.
3. Kiểm tra các link, popup, theme và ảnh local.
4. Commit và push sau khi đã duyệt preview.
