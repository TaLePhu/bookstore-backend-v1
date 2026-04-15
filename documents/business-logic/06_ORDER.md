# Order - Logic Nghiệp Vụ

## 1. Mục tiêu
Feature Order xử lý bước checkout từ giỏ hàng sang đơn hàng và truy xuất danh sách, chi tiết đơn hàng của user.

## 2. Actor và quyền truy cập
- Chỉ người dùng đã đăng nhập mới được thao tác.
- User chỉ xem được đơn hàng thuộc về chính mình.

## 3. Luồng nghiệp vụ chính

### 3.1 Tạo đơn hàng từ giỏ
1. Người dùng gửi addressId, shippingFee và note.
2. Hệ thống lấy cart active của user.
3. Nếu giỏ rỗng thì từ chối tạo đơn.
4. Hệ thống kiểm tra address có thuộc về user không.
5. Toàn bộ bước write chạy trong một transaction.
6. Mỗi book trong giỏ được lock pessimistic_write để tránh tranh chấp stock.
7. Hệ thống kiểm tra stock của từng book trước khi tạo order.
8. Nếu hợp lệ, hệ thống tạo Order với status PENDING.
9. Hệ thống tạo OrderItem tương ứng, trừ stock của từng book và xoá toàn bộ CartItem trong giỏ.
10. Sau cùng hệ thống reload đơn hàng và trả kết quả mới nhất cho client.

### 3.2 Lấy danh sách đơn hàng của tôi
1. User gọi endpoint danh sách đơn hàng của mình.
2. Hệ thống trả về dữ liệu có phân trang.
3. Chỉ đơn hàng thuộc user hiện tại mới được trả ra.

### 3.3 Xem chi tiết đơn hàng
1. User gửi orderId.
2. Hệ thống tìm order theo id và userId.
3. Nếu không thuộc về user hiện tại thì trả lỗi không tìm thấy.

## 4. Ràng buộc nghiệp vụ
- Checkout là thao tác toàn bộ cart, không phải chọn từng item để tạo đơn riêng trong flow hiện tại.(vấn đề: thực tế: user sẽ chọn từng item trong giỏ để checkout, có thể chọn tất cả, không chọn không cho checkout).
- Địa chỉ giao hàng phải thuộc về chính user tạo đơn.
- Stock phải đủ cho toàn bộ item trong cart trước khi commit transaction.
- Sau khi tạo đơn thành công, cart items bị xoá để cart trở về rỗng.
- Order mới tạo luôn bắt đầu ở trạng thái PENDING.

## 5. Side effect và trạng thái
- Tạo đơn làm thay đổi đồng thời Order, OrderItem, Book stock và CartItem.
- Đây là luồng có transaction boundary quan trọng nhất trong hệ thống.

## 6. Điểm cần lưu ý khi test
- Tạo đơn khi cart rỗng phải bị chặn.
- Address không thuộc user phải bị từ chối.
- Nếu một sách không đủ stock thì toàn bộ checkout phải fail.
- Sau khi checkout thành công, stock phải giảm và cart phải rỗng.
- User không được xem đơn của người khác.

## 7. File liên quan
- [src/services/OrderService.ts](../../src/services/OrderService.ts)
- [src/controllers/OrderController.ts](../../src/controllers/OrderController.ts)
- [src/routes/order.routes.ts](../../src/routes/order.routes.ts)
- [src/dtos/order/CreateOrderDto.ts](../../src/dtos/order/CreateOrderDto.ts)
- [src/entities/Order.ts](../../src/entities/Order.ts)
- [src/entities/OrderItem.ts](../../src/entities/OrderItem.ts)
- [src/entities/Cart.ts](../../src/entities/Cart.ts)
- [src/entities/CartItem.ts](../../src/entities/CartItem.ts)
- [src/entities/Address.ts](../../src/entities/Address.ts)