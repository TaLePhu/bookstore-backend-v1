# User - Logic Nghiệp Vụ

## 1. Mục tiêu
Feature User quản lý hồ sơ cá nhân, thông tin mở rộng và đổi mật khẩu của người dùng đã đăng nhập.

## 2. Actor và quyền truy cập
- Chỉ người dùng đã đăng nhập mới có thể truy cập.
- Mọi thao tác đều gắn với chính tài khoản hiện tại, không thao tác chéo user.

## 3. Luồng nghiệp vụ chính

### 3.1 Xem hồ sơ cá nhân
1. Người dùng gọi lấy profile của mình.
2. Hệ thống tải user kèm quan hệ userAdvance.
3. Trả về thông tin cơ bản và thông tin mở rộng nếu có.

### 3.2 Cập nhật hồ sơ
1. Người dùng gửi các trường cập nhật như fullName, avatar, dob, gender, phone.
2. Hệ thống tải user hiện tại kèm userAdvance.
3. fullName được cập nhật trực tiếp trên user.
4. Các trường mở rộng được cập nhật trên userAdvance; nếu chưa có bản ghi thì hệ thống tạo mới.
5. Nếu dob được gửi lên, hệ thống chuyển sang kiểu Date trước khi lưu.
6. Sau khi lưu, hệ thống tải lại user để trả về dữ liệu mới nhất.

### 3.3 Đổi mật khẩu
1. Người dùng gửi oldPassword và newPassword.
2. Hệ thống kiểm tra mật khẩu cũ có đúng không.
3. Nếu sai thì từ chối yêu cầu.
4. Nếu đúng thì hash mật khẩu mới và lưu lại.
5. Sau khi đổi mật khẩu, hệ thống thu hồi toàn bộ refresh token hiện có của user.
6. Hệ thống sinh cặp token mới để người dùng tiếp tục đăng nhập.

## 4. Ràng buộc nghiệp vụ
- User chỉ được xem và sửa chính hồ sơ của mình.
- userAdvance là phần mở rộng, có thể chưa tồn tại ở thời điểm user mới tạo.
- Thay đổi mật khẩu phải làm vô hiệu toàn bộ phiên đăng nhập cũ.
- Các trường profile cập nhật theo kiểu overwrite, không phải merge phức tạp theo lịch sử.
- Trường địa chỉ giao hàng không còn nằm trong profile update; địa chỉ được quản lý riêng trong bảng `addresses`.
- Một user có thể có nhiều địa chỉ và order sẽ resolve theo `addressId` hoặc inline address tại thời điểm checkout.

## 5. Side effect và trạng thái
- Cập nhật profile có thể tạo mới userAdvance nếu trước đó chưa có.
- Đổi mật khẩu sẽ revoke toàn bộ refresh token cũ và cấp bộ token mới.

## 6. Điểm cần lưu ý khi test
- Xem profile phải trả đủ thông tin cơ bản và mở rộng.
- Cập nhật từng phần profile không được làm mất dữ liệu các trường khác.
- Đổi mật khẩu sai oldPassword phải bị chặn.
- Sau khi đổi mật khẩu, refresh token cũ phải không còn dùng được.

## 7. File liên quan
- [src/services/UserService.ts](../../src/services/UserService.ts)
- [src/controllers/UserController.ts](../../src/controllers/UserController.ts)
- [src/routes/user.routes.ts](../../src/routes/user.routes.ts)
- [src/dtos/user/UpdateProfileDto.ts](../../src/dtos/user/UpdateProfileDto.ts)
- [src/dtos/user/ChangePasswordDto.ts](../../src/dtos/user/ChangePasswordDto.ts)
- [src/entities/UserAdvance.ts](../../src/entities/UserAdvance.ts)
- [src/entities/Address.ts](../../src/entities/Address.ts)