# Book và Search - Logic Nghiệp Vụ

## 1. Mục tiêu
Feature Book quản lý danh sách sách, xem chi tiết sách và tìm kiếm sách theo từ khóa.

## 2. Actor và quyền truy cập
- Tất cả endpoint sách hiện tại là public.
- Người dùng chưa đăng nhập vẫn có thể xem danh sách, chi tiết và tìm kiếm.

## 3. Luồng nghiệp vụ chính

### 3.1 Lấy danh sách sách
1. Client gửi page và limit.
2. Hệ thống chuẩn hoá phân trang an toàn: page nhỏ hơn 1 sẽ được đưa về 1, limit bị giới hạn trong khoảng 1 đến 50.
3. Hệ thống trả về data và metadata phân trang.

### 3.2 Xem chi tiết sách
1. Client gửi id của sách.
2. Hệ thống kiểm tra id có đúng định dạng UUID hay không.
3. Nếu không đúng định dạng thì trả lỗi 400 ngay ở controller.
4. Nếu đúng định dạng nhưng không có bản ghi thì trả lỗi không tìm thấy.

### 3.3 Tìm kiếm sách
1. Client gửi query q cùng page và limit.
2. Nếu query rỗng hoặc chỉ có khoảng trắng thì hệ thống trả về danh sách rỗng.
3. Nếu query hợp lệ thì hệ thống gọi repository search để tìm dữ liệu phù hợp.
4. Kết quả trả về vẫn theo cùng cấu trúc data + pagination.

## 4. Ràng buộc nghiệp vụ
- Pagination phải an toàn, không cho limit vượt quá 50.
- Chi tiết sách chỉ hợp lệ với UUID đúng định dạng.
- Query rỗng không được quăng lỗi; thay vào đó trả về danh sách rỗng.
- Search hiện tại là nghiệp vụ truy xuất, không có bước write state.

## 5. Side effect và trạng thái
- Feature này không thay đổi dữ liệu.
- Mọi thao tác đều là read-only.

## 6. Điểm cần lưu ý khi test
- page âm hoặc bằng 0 phải được chuẩn hoá về 1.
- limit lớn hơn 50 phải bị cắt xuống 50.
- id sai định dạng phải trả 400 trước khi đi vào service.
- q rỗng phải trả danh sách rỗng, không phải lỗi.

## 7. File liên quan
- [src/services/BookService.ts](../../src/services/BookService.ts)
- [src/controllers/BookController.ts](../../src/controllers/BookController.ts)
- [src/routes/book.routes.ts](../../src/routes/book.routes.ts)
- [src/dtos/book/BookResponseDto.ts](../../src/dtos/book/BookResponseDto.ts)
- [src/entities/Book.ts](../../src/entities/Book.ts)
- [src/entities/BookImage.ts](../../src/entities/BookImage.ts)
- [src/services/EmbeddingSearchService.ts](../../src/services/EmbeddingSearchService.ts)