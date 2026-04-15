# Shared Business Rules

## 1. Mục tiêu
Tài liệu này gom các quy tắc nghiệp vụ dùng chung cho nhiều feature, đặc biệt là các luồng có authentication, role guard, validation, transaction và side effect.

## 2. Quy tắc dùng chung
- Auth middleware là điều kiện bắt buộc cho các route cần đăng nhập.
- Role guard giới hạn các route admin theo role ADMIN.
- Validate middleware phải chặn request sai cấu trúc trước khi đi vào service.
- Error handling phải phân biệt rõ lỗi không tìm thấy, lỗi xung đột, lỗi không có quyền và lỗi dữ liệu không hợp lệ.

## 3. Các invariant quan trọng
- Email user phải duy nhất.
- Refresh token phải được lưu và thu hồi rõ ràng theo vòng đời đăng nhập.
- Stock sách không được âm và không được vượt thực tế khi checkout hoặc thêm giỏ.
- Order checkout phải chạy trong transaction để tránh mất đồng bộ giữa order, order item, cart và stock.
- Item trong cart chỉ được thao tác bởi đúng chủ sở hữu.
- Admin không được tự khoá chính mình hoặc tự đổi role của chính mình.

## 4. Side effect hệ thống
- Đăng ký, xác thực email và reset password có thể phát sinh email queue.
- Đổi mật khẩu hoặc logout làm vô hiệu phiên đăng nhập cũ thông qua refresh token.
- Checkout đơn hàng làm thay đổi đồng thời nhiều bảng nên phải được xem là luồng nhạy cảm nhất.

## 5. Quy tắc test chung
- Kiểm tra quyền truy cập trước khi kiểm tra logic nghiệp vụ sâu.
- Các luồng write cần có test cho cả case thành công và case fail giữa transaction.
- Các luồng có queue/Redis cần test cả trạng thái dữ liệu tạm và trạng thái DB cuối cùng.

## 6. File liên quan
- [src/middlewares/auth.middleware.ts](../../src/middlewares/auth.middleware.ts)
- [src/middlewares/role.middleware.ts](../../src/middlewares/role.middleware.ts)
- [src/middlewares/validate.middleware.ts](../../src/middlewares/validate.middleware.ts)
- [src/middlewares/error.middleware.ts](../../src/middlewares/error.middleware.ts)
- [src/config/queue.ts](../../src/config/queue.ts)
- [src/config/redis.ts](../../src/config/redis.ts)