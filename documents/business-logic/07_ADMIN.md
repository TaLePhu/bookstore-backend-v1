# Admin User Management - Logic Nghiệp Vụ

## 1. Mục tiêu
Feature Admin quản lý tài khoản người dùng, quản lý sách và quản lý danh mục: xem danh sách, khoá/mở khoá, thay đổi role, reset mật khẩu, xem tổng quan khách hàng, tạo/cập nhật sách và danh mục.

## 2. Actor và quyền truy cập
- Chỉ người dùng đã đăng nhập và có role ADMIN mới truy cập được.
- Toàn bộ route admin đều đi qua auth middleware và role guard.

## 3. Luồng nghiệp vụ chính

### 3.1 Xem danh sách user
1. Admin gửi filter theo role, email, full_name, page và limit.
2. Hệ thống truy vấn danh sách người dùng theo bộ lọc.
3. Kết quả trả về đã được map sang shape an toàn, không lộ passwordHash.

### 3.2 Khoá hoặc mở khoá user
1. Admin gửi id và isLocked.
2. Hệ thống cấm admin tự khoá chính mình.
3. Nếu hợp lệ, hệ thống cập nhật trạng thái khoá/mở khoá của user.

### 3.3 Thay đổi role
1. Admin gửi id và role mới.
2. Hệ thống cấm admin tự đổi role của chính mình.
3. Nếu hợp lệ, hệ thống cập nhật role cho user.

### 3.4 Reset mật khẩu
1. Admin gửi newPassword cho user mục tiêu.
2. Hệ thống hash mật khẩu mới và lưu vào DB.
3. Nếu user tồn tại, hệ thống gửi email thông báo qua BullMQ.
4. Người dùng phải đăng nhập lại bằng mật khẩu mới sau khi được reset.

### 3.5 Xem tổng quan khách hàng
1. Admin gọi endpoint summary theo customer id.
2. Hệ thống trả về hồ sơ khách hàng và số liệu tổng hợp.

### 3.6 Quản lý sách (Admin)
1. Admin tạo sách mới với thông tin bắt buộc và danh sách hình ảnh.
2. Hệ thống validate dữ liệu đầu vào theo DTO.
3. Hệ thống kiểm tra categoryId tồn tại trước khi tạo.
4. Hệ thống tạo book và các ảnh liên quan.
5. Admin có thể cập nhật sách theo id và danh sách ảnh mới (nếu truyền images).

### 3.7 Quản lý danh mục (Admin)
1. Admin tạo danh mục mới với name/description.
2. Admin cập nhật danh mục theo id.
3. Admin xoá danh mục theo id.

## 4. Ràng buộc nghiệp vụ
- Không cho admin thao tác tự hạ cấp hoặc tự khoá chính mình.
- Reset mật khẩu phải tạo side effect gửi email để user biết thay đổi.
- Danh sách admin không được lộ hash mật khẩu.
- Các action này chỉ hợp lệ khi request đã được bảo vệ bởi auth và role guard.
- Create/Update book yêu cầu dữ liệu hợp lệ, categoryId phải tồn tại.
- Update book không bắt buộc truyền images; nếu có images thì ghi đè ảnh cũ.
- Update/Delete category yêu cầu id hợp lệ, sai định dạng trả lỗi 400.

## 5. Side effect và trạng thái
- Khoá user làm ảnh hưởng trực tiếp tới khả năng đăng nhập và refresh token của tài khoản đó.
- Reset mật khẩu tạo email queue thông báo cho user.
- Đổi role có thể thay đổi quyền truy cập ngay ở các request kế tiếp nếu token hiện tại vẫn còn hiệu lực.
- Tạo/cập nhật sách sẽ sinh bản ghi ảnh (book_images).
- Cập nhật sách có thể xoá cache chi tiết sách (nếu có).

## 6. Điểm cần lưu ý khi test
- Admin không được khoá chính mình.
- Admin không được tự đổi role của chính mình.
- Reset password thành công phải phát sinh email queue.
- User bị khoá phải bị chặn ở luồng login và refresh token.
- Tạo sách với categoryId không tồn tại phải trả 404.
- Update sách với id sai định dạng phải trả 400.
- Update sách truyền images phải thay thế toàn bộ ảnh cũ.
- Xoá category không hợp lệ phải trả lỗi 400/404 theo tình huống.

## 7. File liên quan
- [src/services/AdminUserService.ts](../../src/services/AdminUserService.ts)
- [src/controllers/AdminUserController.ts](../../src/controllers/AdminUserController.ts)
- [src/services/BookService.ts](../../src/services/BookService.ts)
- [src/services/CategoryService.ts](../../src/services/CategoryService.ts)
- [src/routes/admin.routes.ts](../../src/routes/admin.routes.ts)
- [src/dtos/admin/UpdateUserStatusDto.ts](../../src/dtos/admin/UpdateUserStatusDto.ts)
- [src/dtos/admin/UpdateUserRoleDto.ts](../../src/dtos/admin/UpdateUserRoleDto.ts)
- [src/dtos/admin/ResetPasswordDto.ts](../../src/dtos/admin/ResetPasswordDto.ts)
- [src/dtos/book/CreateBookDto.ts](../../src/dtos/book/CreateBookDto.ts)
- [src/dtos/book/UpdateBookDto.ts](../../src/dtos/book/UpdateBookDto.ts)
- [src/dtos/category/CreateCategoryDto.ts](../../src/dtos/category/CreateCategoryDto.ts)
- [src/dtos/category/UpdateCategoryDto.ts](../../src/dtos/category/UpdateCategoryDto.ts)
- [src/entities/User.ts](../../src/entities/User.ts)
- [src/entities/Book.ts](../../src/entities/Book.ts)
- [src/entities/Category.ts](../../src/entities/Category.ts)