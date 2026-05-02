# Order - Logic Nghiệp Vụ

## 1. Mục tiêu
Feature Order xử lý bước checkout từ giỏ hàng sang đơn hàng và truy xuất danh sách, chi tiết đơn hàng của user.

## 2. Actor và quyền truy cập
- Chỉ người dùng đã đăng nhập mới được thao tác.
- User chỉ xem được đơn hàng thuộc về chính mình.

## 3. Luồng nghiệp vụ chính

### 3.1 Tạo đơn hàng từ giỏ
1. Người dùng gửi yêu cầu checkout với các nhóm dữ liệu sau:
	- `addressId` (nếu dùng địa chỉ đã lưu), hoặc
	- Inline address bắt buộc đầy đủ thông tin: `receiverName`, `phone`, `country`, `provinceCode`, `provinceName`, `districtCode`, `districtName`, `wardCode`, `wardName`, `addressLine`.
	- `cartItemIds` (optional) để chỉ checkout một phần giỏ hàng.
	- `paymentMethod` (optional), mặc định `COD`.
	- `shippingFee`, `note` (optional).
2. Hệ thống lấy cart active của user.
3. Nếu giỏ rỗng thì từ chối tạo đơn.
4. Nếu có `cartItemIds`, hệ thống lọc item theo danh sách này và từ chối nếu có item không thuộc giỏ hiện tại.
5. Hệ thống resolve địa chỉ giao hàng:
	- Nếu có `addressId`: bắt buộc địa chỉ phải thuộc về user hiện tại.
	- Nếu không có `addressId`: bắt buộc đủ 10 trường thông tin địa chỉ như trên để tạo mới Address và gán vào order.
6. Toàn bộ bước write chạy trong một transaction.
7. Mỗi book trong nhóm item được checkout được lock `pessimistic_write` để tránh tranh chấp stock.
8. Hệ thống kiểm tra stock từng book trước khi tạo order.
9. Nếu hợp lệ, hệ thống sinh mã đơn hàng `orderCode` (định dạng `ORD-[DDMMYY]-[4 ký tự ngẫu nhiên]`) và tạo Order với status `PENDING`.
10. Hệ thống tạo Payment tương ứng với `paymentMethod` (mặc định `COD`) và `amount = totalAmount`.
11. Hệ thống tạo OrderItem, trừ stock của từng book và chỉ xoá các CartItem đã được checkout.
12. Sau cùng hệ thống reload đơn hàng và trả kết quả mới nhất cho client.

Ghi chú:
- Nếu FE có danh sách địa chỉ đã lưu, có thể preselect địa chỉ mặc định.
- Backend không auto chọn địa chỉ theo default ở bước checkout; request vẫn phải truyền `addressId` hoặc inline address hợp lệ.

### 3.2 Lấy danh sách đơn hàng của tôi
1. User gọi endpoint danh sách đơn hàng của mình.
2. Hệ thống trả về dữ liệu có phân trang.
3. Chỉ đơn hàng thuộc user hiện tại mới được trả ra.

### 3.3 Xem chi tiết đơn hàng
1. User gửi orderId.
2. Hệ thống tìm order theo id và userId.
3. Nếu không thuộc về user hiện tại thì trả lỗi không tìm thấy.

## 4. Ràng buộc nghiệp vụ
- Hỗ trợ partial checkout: user có thể truyền `cartItemIds` để checkout một phần giỏ.
- Nếu có truyền `cartItemIds`, tất cả ID phải thuộc giỏ hiện tại của user.
- Địa chỉ giao hàng phải resolve được theo một trong hai cách:
	- `addressId` thuộc chính user tạo đơn, hoặc
	- Inline address đủ 10 trường thông tin.
- Nếu không có `addressId` và thiếu thông tin inline thì trả lỗi `400`.
- Stock phải đủ cho các item thực sự được checkout trước khi commit transaction.
- Sau khi tạo đơn thành công, chỉ các cart item đã checkout mới bị xoá.
- Order mới tạo luôn bắt đầu ở trạng thái `PENDING`.

## 5. Side effect và trạng thái
- Tạo đơn làm thay đổi đồng thời Order, Payment, OrderItem, Book stock và CartItem.
- Nếu user checkout bằng inline address, hệ thống tự tạo thêm một Address record mới gắn với user.
- Đây là luồng có transaction boundary quan trọng nhất trong hệ thống.

## 6. Technical notes (15/04)
- Payment enum cần đồng bộ đúng type enum của bảng `payments` trong migration để tránh mismatch type name.
- Payment bắt buộc có `amount`, giá trị được set bằng `totalAmount` khi tạo order trong transaction.

## 7. Điểm cần lưu ý khi test
- Tạo đơn khi cart rỗng phải bị chặn.
- Truyền `cartItemIds` không thuộc giỏ hiện tại phải bị từ chối.
- Không có `addressId` và thiếu một trong các trường inline address phải trả lỗi `400`.
- Address không thuộc user phải bị từ chối.
- Nếu một sách không đủ stock thì toàn bộ checkout phải fail.
- Sau khi checkout thành công, stock phải giảm và chỉ các item đã checkout bị xoá khỏi giỏ.
- Payment được tạo với method đúng theo request (hoặc `COD` mặc định) và `amount` khác null.
- User không được xem đơn của người khác.

## 8. File liên quan
- [src/services/OrderService.ts](../../src/services/OrderService.ts)
- [src/controllers/OrderController.ts](../../src/controllers/OrderController.ts)
- [src/routes/order.routes.ts](../../src/routes/order.routes.ts)
- [src/dtos/order/CreateOrderDto.ts](../../src/dtos/order/CreateOrderDto.ts)
- [src/entities/Order.ts](../../src/entities/Order.ts)
- [src/entities/OrderItem.ts](../../src/entities/OrderItem.ts)
- [src/entities/Payment.ts](../../src/entities/Payment.ts)
- [src/entities/Cart.ts](../../src/entities/Cart.ts)
- [src/entities/CartItem.ts](../../src/entities/CartItem.ts)
- [src/entities/Address.ts](../../src/entities/Address.ts)