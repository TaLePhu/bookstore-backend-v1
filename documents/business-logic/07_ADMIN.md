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
1. Admin tạo sách mới với thông tin bắt buộc và danh sách hình ảnh (multipart/form-data).
2. Middleware upload kiểm tra định dạng và dung lượng ảnh (jpg/png/webp, <= 2MB/anh, toi da 5 anh).
3. Hệ thống validate dữ liệu đầu vào theo DTO (chuyen doi tu form-data).
4. Hệ thống kiểm tra categoryId tồn tại trước khi tạo.
5. Upload ảnh lên Cloudinary, lay `secure_url` va `public_id`.
6. Mo transaction DB: tao `books` va tao `book_images` (url + public_id).
7. Neu transaction fail, he thong xoa anh vua upload (rollback Cloudinary).
8. Admin cap nhat sach:
	- Neu khong gui anh: chi update book.
	- Neu gui anh: upload anh moi, transaction thay the toan bo `book_images`, sau khi commit thi xoa anh cu tren Cloudinary.

### 3.7 Quản lý danh mục (Admin)
1. Admin tạo danh mục mới với name/description.
2. Admin cập nhật danh mục theo id.
3. Admin xoá danh mục theo id.

### 3.8 Quản lý đơn hàng (Admin)
1. Admin xem danh sách đơn hàng có lọc theo trạng thái và phân trang.
2. Xem chi tiết đơn hàng theo ID.
3. Tìm kiếm đơn hàng theo mã đơn (order code).
4. Cập nhật trạng thái đơn hàng (PENDING -> SHIPPING -> COMPLETED).
5. Xử lý yêu cầu huỷ đơn hàng từ khách hàng (chấp nhận hoặc từ chối kèm lý do).
6. Xem thống kê (stats) của nhân viên xử lý và tra cứu lịch sử mua hàng theo email/sđt.

### 3.9 Quản lý khuyến mãi (Admin)
1. Admin quản lý các chương trình khuyến mãi: list, tạo mới, cập nhật, xóa.
2. Khi tạo/sửa có thể đính kèm banner, ảnh sẽ được upload lên Cloudinary.

### 3.10 Admin Dashboard
1. Admin truy cập API dashboard để lấy dữ liệu tổng quan.
2. Dữ liệu bao gồm các chỉ số thống kê tổng quát về doanh thu, số lượng đơn hàng, người dùng, v.v.

## 4. Ràng buộc nghiệp vụ
- Không cho admin thao tác tự hạ cấp hoặc tự khoá chính mình.
- Reset mật khẩu phải tạo side effect gửi email để user biết thay đổi.
- Danh sách admin không được lộ hash mật khẩu.
- Các action này chỉ hợp lệ khi request đã được bảo vệ bởi auth và role guard.
- Create/Update book yêu cầu dữ liệu hợp lệ, categoryId phải tồn tại.
- Update book không bắt buộc truyền ảnh; nếu có ảnh thì ghi đè toàn bộ ảnh cũ.
- Upload ảnh bắt buộc: 1-5 file, jpg/png/webp, <= 2MB/ảnh.
- Ảnh được upload trước khi ghi DB; khi DB lỗi phải rollback Cloudinary.
- Update/Delete category yêu cầu id hợp lệ, sai định dạng trả lỗi 400.

## 5. Side effect và trạng thái
- Khoá user làm ảnh hưởng trực tiếp tới khả năng đăng nhập và refresh token của tài khoản đó.
- Reset mật khẩu tạo email queue thông báo cho user.
- Đổi role có thể thay đổi quyền truy cập ngay ở các request kế tiếp nếu token hiện tại vẫn còn hiệu lực.
- Tạo/cập nhật sách sẽ sinh bản ghi ảnh (book_images).
- Cập nhật sách có thể xoá cache chi tiết sách (nếu có).
- Thay thế ảnh sẽ xoá ảnh cũ trên Cloudinary sau khi DB commit thành công.

## 6. Điểm cần lưu ý khi test
- Admin không được khoá chính mình.
- Admin không được tự đổi role của chính mình.
- Reset password thành công phải phát sinh email queue.
- User bị khoá phải bị chặn ở luồng login và refresh token.
- Tạo sách với categoryId không tồn tại phải trả 404.
- Update sách với id sai định dạng phải trả 400.
- Update sách truyền ảnh phải thay thế toàn bộ ảnh cũ.
- Upload ảnh sai định dạng/dung lượng phải trả 400.
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