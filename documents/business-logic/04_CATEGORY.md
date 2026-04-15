# Category - Logic Nghiệp Vụ

## 1. Mục tiêu
Feature Category cung cấp danh sách danh mục sách để phục vụ hiển thị và lọc phía client.

## 2. Actor và quyền truy cập
- Endpoint hiện tại là public.
- Không yêu cầu đăng nhập.

## 3. Luồng nghiệp vụ chính
1. Client gọi lấy toàn bộ danh mục.
2. Hệ thống truy vấn repository và trả về danh sách Category.
3. Không có phân trang, lọc hay biến đổi dữ liệu ở tầng service.

## 4. Ràng buộc nghiệp vụ
- Dữ liệu category được xem là dữ liệu nền cho book listing.
- Feature này không sinh state mới và không thay đổi dữ liệu.

## 5. Side effect và trạng thái
- Read-only.

## 6. Điểm cần lưu ý khi test
- Endpoint phải trả danh sách category trống nếu chưa có dữ liệu.
- Không nên yêu cầu auth cho luồng này.

## 7. File liên quan
- [src/services/CategoryService.ts](../../src/services/CategoryService.ts)
- [src/controllers/CategoryController.ts](../../src/controllers/CategoryController.ts)
- [src/routes/category.routes.ts](../../src/routes/category.routes.ts)
- [src/entities/Category.ts](../../src/entities/Category.ts)