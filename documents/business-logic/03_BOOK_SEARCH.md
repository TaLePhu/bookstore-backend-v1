# Book và Search - Logic Nghiệp Vụ

## 1. Mục tiêu
Feature Book quản lý danh sách sách, xem chi tiết sách, tìm kiếm sách theo từ khóa, lấy sách mới phát hành, lọc sách theo danh mục và lấy danh sách bán chạy trong tháng.

## 2. Actor và quyền truy cập
- Tất cả endpoint sách hiện tại là public.
- Người dùng chưa đăng nhập vẫn có thể xem danh sách, chi tiết, tìm kiếm, sách mới phát hành, sách theo danh mục và sách bán chạy.

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

### 3.4 Lấy sách mới phát hành (Top 10)
1. Client gọi endpoint `GET /books/latest`.
2. Hệ thống truy vấn sách, sắp xếp theo `release_date` giảm dần, các bản ghi `NULL release_date` được đưa xuống cuối.
3. Nếu trùng ngày phát hành thì tie-break theo `createdAt` giảm dần.
4. Kết quả trả về tối đa 10 cuốn.

### 3.5 Lấy sách theo categoryId (Top 10)
1. Client gọi endpoint `GET /books/category/:categoryId`.
2. Controller kiểm tra `categoryId` có đúng UUID hay không:
	- Sai định dạng -> trả lỗi 400.
3. Service kiểm tra category có tồn tại hay không:
	- Không tồn tại -> trả lỗi 404.
4. Nếu hợp lệ, hệ thống lọc theo `categoryId`, sắp xếp theo `release_date` giảm dần và trả tối đa 10 cuốn.

### 3.6 Lấy sách bán chạy trong tháng (Top 10)
1. Client gọi endpoint `GET /books/best-sellers`.
2. Hệ thống aggregate từ `orders` và `order_items` theo tháng hiện tại (UTC+7).
3. Chỉ tính các đơn có trạng thái `COMPLETED`.
4. Group theo sách, sắp xếp theo tổng `quantity` bán ra giảm dần.
5. Kết quả trả về tối đa 10 cuốn; nếu dữ liệu không đủ thì trả ít hơn 10.

## 4. Ràng buộc nghiệp vụ
- Pagination phải an toàn, không cho limit vượt quá 50.
- Chi tiết sách chỉ hợp lệ với UUID đúng định dạng.
- Query rỗng không được quăng lỗi; thay vào đó trả về danh sách rỗng.
- Search hiện tại là nghiệp vụ truy xuất, không có bước write state.
- `GET /books/latest` cố định trả tối đa 10 cuốn, không nhận query `limit`.
- `GET /books/category/:categoryId` cố định trả tối đa 10 cuốn, không nhận query `limit`.
- `GET /books/best-sellers` cố định trả tối đa 10 cuốn, không nhận query `limit`.
- Best-sellers chỉ tính đơn `COMPLETED` trong tháng hiện tại theo UTC+7.
- `release_date` được phép `NULL` trong DB để tương thích dữ liệu cũ; dữ liệu `NULL` không được ưu tiên trong API latest.

## 5. Side effect và trạng thái
- Feature này không thay đổi dữ liệu.
- Mọi thao tác đều là read-only.

## 6. Điểm cần lưu ý khi test
- page âm hoặc bằng 0 phải được chuẩn hoá về 1.
- limit lớn hơn 50 phải bị cắt xuống 50.
- id sai định dạng phải trả 400 trước khi đi vào service.
- q rỗng phải trả danh sách rỗng, không phải lỗi.
- `GET /books/latest` trả `200` với tối đa 10 phần tử, thứ tự theo `release_date DESC`.
- `GET /books/category/:categoryId` với UUID sai định dạng phải trả `400`.
- `GET /books/category/:categoryId` với UUID hợp lệ nhưng category không tồn tại phải trả `404`.
- `GET /books/category/:categoryId` với category hợp lệ trả tối đa 10 cuốn đúng danh mục.
- `GET /books/best-sellers` trả tối đa 10 cuốn; có thể là mảng rỗng nếu tháng hiện tại chưa có đơn `COMPLETED`.

## 7. File liên quan
- [src/services/BookService.ts](../../src/services/BookService.ts)
- [src/controllers/BookController.ts](../../src/controllers/BookController.ts)
- [src/routes/book.routes.ts](../../src/routes/book.routes.ts)
- [src/repositories/interfaces/IBookRepository.ts](../../src/repositories/interfaces/IBookRepository.ts)
- [src/repositories/typeorm/BookRepository.ts](../../src/repositories/typeorm/BookRepository.ts)
- [src/repositories/interfaces/ICategoryRepository.ts](../../src/repositories/interfaces/ICategoryRepository.ts)
- [src/repositories/typeorm/CategoryRepository.ts](../../src/repositories/typeorm/CategoryRepository.ts)
- [src/dtos/book/BookResponseDto.ts](../../src/dtos/book/BookResponseDto.ts)
- [src/entities/Book.ts](../../src/entities/Book.ts)
- [src/migrations/1776600000000-AddBookReleaseDate.ts](../../src/migrations/1776600000000-AddBookReleaseDate.ts)
- [src/migrations/1776600000001-BackfillBookReleaseDate.ts](../../src/migrations/1776600000001-BackfillBookReleaseDate.ts)
- [src/entities/BookImage.ts](../../src/entities/BookImage.ts)
- [src/services/EmbeddingSearchService.ts](../../src/services/EmbeddingSearchService.ts)