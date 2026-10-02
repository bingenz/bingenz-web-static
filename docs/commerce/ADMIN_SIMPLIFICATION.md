# Cửa hàng và admin gọn hơn — 02/10/2026

Cửa hàng hiển thị toàn bộ sản phẩm đang bán, với ảnh tải khi cuộn. Không còn nút Xem thêm hoặc popup Chi tiết sản phẩm. Mỗi thẻ ghi danh mục, tên, giá, thời lượng và hạn bắt đầu; giỏ hàng và checkout giữ luồng hiện tại.

## Admin

- Mặc định mở **Đơn hàng**: tìm kiếm và lọc trạng thái; chi tiết đơn chứa ghi chú, cấp lại liên kết, quyền truy cập và hoàn tiền trong phần thu gọn. Đối soát nằm trong mục này. Ngày giờ hiển thị theo Việt Nam.
- **Sản phẩm**: bảng ảnh/tên/giá/trạng thái/vị trí; nút Sửa và Xóa; Thêm sản phẩm tạo bản nháp. Tệp HTML, ảnh, phiên bản, xem thử và thiết lập vẫn sử dụng API được bảo vệ.
- Xóa bản nháp trống là xóa vĩnh viễn. Sản phẩm có nội dung được lưu trữ và ngừng bán, giữ quyền của khách đã mua. Khôi phục đưa về bản nháp cuối danh sách, chưa mở bán.
- Tổng quan lớn, bán chạy, chỉnh sửa hàng loạt và nhập metadata đã được gỡ khỏi UI và API. Metadata cũ trong tài liệu được giữ làm dữ liệu tham khảo.

## Sắp xếp

Nhập vị trí hoặc dùng Lên/Xuống; vị trí luôn tính trên toàn bộ sản phẩm chưa lưu trữ, kể cả khi đang lọc. Các sản phẩm còn lại tự dịch vị trí. **Lưu thứ tự** ghi một lần; **Hủy** khôi phục thứ tự đã tải. Cần lưu thông tin sản phẩm trước khi đổi thứ tự, và lưu/hủy thứ tự trước khi thay đổi sản phẩm.

`GET /admin/api/products` bổ sung `snapshot` và cờ `can_delete` cho mỗi sản phẩm. `PATCH /admin/api/products/reorder` nhận `{ids, snapshot}`; `ids` phải chứa đầy đủ sản phẩm chưa lưu trữ, không trùng, tối đa 1.000 mục. Snapshot là chuỗi opaque do GET trả về, bao gồm ID, thứ tự và thời điểm cập nhật. Danh sách sai trả 400; dữ liệu đã thay đổi trả 409. Khi 409, làm mới dữ liệu rồi sắp lại.

D1 kiểm tra snapshot ngay trong UPDATE; thứ tự và một audit `product.reorder` được ghi trong cùng batch transaction. Không có migration. Sản phẩm mới và sản phẩm khôi phục nằm cuối danh sách; lần lưu thứ tự đánh số liên tiếp từ 1.

## Kiểm tra và phát hành

- `npm test`: 45/45 qua, gồm Worker/D1/R2 thật ở local, browser admin và cửa hàng.
- Kiểm tra 1440/430/390/360 px, sáng/tối cửa hàng, không tràn ngang; nhập vị trí, lên/xuống, lưu/hủy, điều hướng và bàn phím.
- Kiểm tra ID trùng/thiếu/sai, JWT/origin, hai lần lưu đồng thời, thay đổi giữa validation và UPDATE, rollback khi audit thất bại, thứ tự catalog và quyền đã mua sau lưu trữ.
- Token asset thống nhất: `20261002-1`. Có kiểm thử reload cùng browser context từ URL asset cũ; kiểm tra production cũng dùng phiên đã mở bản trước.
- Đóng gói với `wrangler deploy --dry-run --config wrangler.toml`; kiểm tra preview riêng trước khi push `master` và chờ Workers Builds.
- Mốc rollback trước release: source `939e13d`, Worker `e66da226-e951-4bc3-92a4-ffaaf863631f`. Rollback mã Worker không xóa D1/R2.

Bộ lọc đơn áp dụng trên tối đa 100 kết quả API trả về, chưa phải phân trang toàn bộ lịch sử. Kiểm thử không tạo chuyển khoản thật; không sửa secret, bindings hay cấu hình thanh toán.
