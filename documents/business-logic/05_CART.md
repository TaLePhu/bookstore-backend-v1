# Cart - Logic Nghiệp Vụ

## 1. Mục tiêu
Feature Cart quản lý giỏ hàng hiện tại của user, gồm xem giỏ, thêm sản phẩm, cập nhật số lượng và xoá item.

## 2. Actor và quyền truy cập
- Chỉ người dùng đã đăng nhập mới truy cập được.
- Mọi thao tác đều áp dụng trên giỏ hàng active của user hiện tại.

## 3. Luồng nghiệp vụ chính

### 3.1 Lấy giỏ hàng hiện tại
1. Hệ thống tìm giỏ active của user.
2. Nếu chưa có giỏ thì tự động tạo giỏ rỗng mới.
3. Trả về giỏ hiện tại, bảo đảm user luôn có một cart logic để thao tác.

### 3.2 Thêm sản phẩm vào giỏ
1. Người dùng gửi bookId và quantity.
2. Hệ thống kiểm tra sách có tồn tại không.
3. Hệ thống kiểm tra số lượng yêu cầu có vượt stock hay không.
4. Nếu sách đã có trong giỏ, hệ thống cộng dồn số lượng.
5. Nếu chưa có, hệ thống tạo CartItem mới.
6. Sau cùng hệ thống trả lại giỏ hàng mới nhất.

### 3.3 Cập nhật số lượng item
1. Người dùng gửi itemId và quantity mới.
2. Hệ thống kiểm tra item có tồn tại không.
3. Hệ thống kiểm tra item đó có thuộc giỏ hiện tại của user hay không.
4. Nếu quantity nhỏ hơn hoặc bằng 0, hệ thống xoá item khỏi giỏ.
5. Nếu quantity lớn hơn 0, hệ thống kiểm tra stock rồi cập nhật số lượng.

### 3.4 Xoá item khỏi giỏ
1. Người dùng gửi itemId.
2. Hệ thống kiểm tra item có tồn tại không.
3. Hệ thống kiểm tra quyền sở hữu với cart hiện tại.
4. Nếu hợp lệ thì xoá item khỏi giỏ và trả về giỏ mới nhất.

## 4. Ràng buộc nghiệp vụ
- Không được thêm hoặc cập nhật vượt quá stock hiện tại của sách.
- Một sách đã tồn tại trong giỏ thì số lượng được cộng dồn thay vì tạo dòng trùng.
- Item chỉ được sửa bởi đúng chủ sở hữu của cart.
- Giỏ rỗng vẫn được xem là một cart hợp lệ.

## 5. Side effect và trạng thái
- Thêm, cập nhật hoặc xoá item đều làm thay đổi state của cart active.
- Khi quantity <= 0, item bị loại khỏi giỏ thay vì giữ bản ghi số lượng âm hoặc bằng 0.

## 6. Điểm cần lưu ý khi test
- Thêm sách không tồn tại phải trả lỗi không tìm thấy.
- Thêm vượt stock phải bị chặn.
- Cùng một sách nhiều lần phải cộng dồn quantity đúng cách.
- Cập nhật item của cart khác phải bị từ chối.
- quantity = 0 phải dẫn tới xoá item.

## 7. File liên quan
- [src/services/CartService.ts](../../src/services/CartService.ts)
- [src/controllers/CartController.ts](../../src/controllers/CartController.ts)
- [src/routes/cart.routes.ts](../../src/routes/cart.routes.ts)
- [src/dtos/cart/AddToCartDto.ts](../../src/dtos/cart/AddToCartDto.ts)
- [src/dtos/cart/UpdateCartItemDto.ts](../../src/dtos/cart/UpdateCartItemDto.ts)
- [src/entities/Cart.ts](../../src/entities/Cart.ts)
- [src/entities/CartItem.ts](../../src/entities/CartItem.ts)
- [src/entities/Book.ts](../../src/entities/Book.ts)