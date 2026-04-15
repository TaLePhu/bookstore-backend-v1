# Auth - Logic Nghiệp Vụ

## 1. Mục tiêu
Feature Auth quản lý vòng đời xác thực tài khoản: đăng ký, gửi mã xác thực email, xác minh email, đăng nhập, làm mới token và đăng xuất.

## 2. Actor và quyền truy cập
- Khách chưa đăng nhập: có thể đăng ký, xác minh email, gửi lại mã xác thực, đăng nhập và làm mới token.
- Người dùng đã đăng nhập: có thể đăng xuất.
- Hệ thống nội bộ: gửi email xác thực qua queue và lưu refresh token vào database.

## 3. Luồng nghiệp vụ chính

### 3.1 Đăng ký tài khoản
1. Người dùng gửi email, userName và password.
2. Hệ thống hash mật khẩu trước khi lưu.
3. Nếu email đã tồn tại thì từ chối bằng lỗi xung đột.
4. Tạo user mới với role mặc định là CUSTOMER và trạng thái isVerified = false.
5. Tạo mã xác thực email mới và gửi qua email queue.

### 3.2 Gửi lại mã xác thực
1. Người dùng nhập email đã đăng ký.
2. Hệ thống kiểm tra user có tồn tại hay không.
3. Nếu tài khoản đã được xác thực thì không gửi lại mã.
4. Nếu chưa xác thực thì tạo mã mới, lưu vào Redis với TTL 15 phút và gửi email mới.

### 3.3 Xác minh email
1. Người dùng gửi email và mã xác thực.
2. Hệ thống đọc mã từ Redis theo email.
3. Nếu mã không tồn tại hoặc đã hết hạn thì từ chối.
4. Nếu mã sai thì tăng bộ đếm số lần nhập sai trong Redis.
5. Khi đạt quá số lần sai cho phép, hệ thống xoá mã và bộ đếm để buộc người dùng xin mã mới.
6. Nếu mã đúng, hệ thống đánh dấu user là đã xác thực, xoá mã trong Redis, sinh access token và refresh token mới, đồng thời lưu refresh token vào DB.

### 3.4 Đăng nhập
1. Người dùng nhập email và password.
2. Hệ thống kiểm tra user có tồn tại không.
3. Chỉ cho đăng nhập nếu tài khoản đã xác thực email.
4. Nếu tài khoản bị khoá thì từ chối đăng nhập.
5. Nếu mật khẩu hợp lệ thì sinh cặp access token và refresh token, sau đó lưu refresh token vào DB.

### 3.5 Làm mới token
1. Client gửi refresh token hợp lệ.
2. Hệ thống kiểm tra refresh token có tồn tại trong DB và chưa bị thu hồi.
3. Nếu token hết hạn thì thu hồi bản ghi tương ứng và từ chối.
4. Nếu chữ ký JWT không hợp lệ thì từ chối.
5. Nếu tài khoản bị khoá thì từ chối.
6. Nếu hợp lệ, hệ thống tạo cặp token mới, thu hồi refresh token cũ và lưu refresh token mới.

### 3.6 Đăng xuất
1. Người dùng đã đăng nhập gọi logout.
2. Hệ thống thu hồi toàn bộ refresh token còn hiệu lực của user.
3. Access token hiện tại sẽ tự hết hạn theo TTL, còn refresh token không còn dùng lại được.

## 4. Ràng buộc nghiệp vụ
- Email phải là duy nhất.
- Chỉ tạo tài khoản CUSTOMER từ luồng đăng ký công khai.
- User chưa xác thực không được đăng nhập.
- User bị khoá không được đăng nhập và cũng không được refresh token.
- Mã xác thực chỉ có hiệu lực 15 phút.
- Nhập sai mã quá số lần cho phép thì phải xin mã mới. (limit: 5)
- Mỗi lần xác minh thành công hoặc làm mới token hợp lệ đều phải lưu refresh token mới vào DB.

## 5. Side effect và trạng thái
- Đăng ký và resend code: phát sinh email queue.
- Verify email: cập nhật trạng thái isVerified của user, xoá dữ liệu tạm trong Redis, sinh token mới.
- Login và refresh token: tạo refresh token record mới.
- Logout: thu hồi toàn bộ refresh token của user.

## 6. Điểm cần lưu ý khi test
- Đăng ký cùng email hai lần phải bị chặn.
- Verify bằng mã sai nhiều lần phải bị khoá luồng xác thực tạm thời.(vd: sau 5 lần thì bắt user chọn gửi lại mã).
- Login khi chưa verify phải bị chặn.
- Login khi account bị lock phải bị chặn.
- Refresh token cũ sau khi refresh phải không còn dùng được.
- Logout phải khiến mọi refresh token hiện có của user bị vô hiệu hóa.

## 7. File liên quan
- [src/services/AuthService.ts](../../src/services/AuthService.ts)
- [src/controllers/AuthController.ts](../../src/controllers/AuthController.ts)
- [src/routes/auth.routes.ts](../../src/routes/auth.routes.ts)
- [src/dtos/auth/RegisterDto.ts](../../src/dtos/auth/RegisterDto.ts)
- [src/dtos/auth/LoginDto.ts](../../src/dtos/auth/LoginDto.ts)
- [src/dtos/auth/VerifyEmailDto.ts](../../src/dtos/auth/VerifyEmailDto.ts)
- [src/dtos/auth/ResendVerificationCodeDto.ts](../../src/dtos/auth/ResendVerificationCodeDto.ts)
- [src/dtos/auth/RefreshTokenDto.ts](../../src/dtos/auth/RefreshTokenDto.ts)