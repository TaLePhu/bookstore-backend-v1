# Book và Search - Logic Nghiệp Vụ

## 1. Mục tiêu
Feature Book quản lý danh sách sách, xem chi tiết sách, tìm kiếm sách theo từ khóa, lọc theo danh mục, và sắp xếp theo mới phát hành hoặc bán chạy.

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

### 3.4 Xem sách liên quan
1. Client gọi endpoint xem sách liên quan truyền id sách.
2. Hệ thống kiểm tra id có đúng UUID không.
3. Lấy dữ liệu danh sách sách cùng category hoặc theo logic gợi ý để trả về.
4. Kết quả hỗ trợ pagination (limit mặc định).

### 3.5 Tìm kiếm ngữ nghĩa (semantic search)
1. Client gọi `GET /books/semantic-search` với query `q`, `page`, `limit`, `threshold`.
2. Nếu `q` rỗng thì trả về danh sách rỗng, `total=0`.
3. Hệ thống sinh embedding cho `q` bằng Gemini, chạy vector search với pgvector.
4. Kết quả semantic sẽ được rerank bằng keyword match (title/author/description/category) với top 50 keyword candidates.
5. Nếu Gemini lỗi, fallback sang keyword search (không fail request).
6. Trả về `data` và `pagination` với `total` là count chính xác theo vector search (khi semantic thành công).

### 3.4 Lấy danh sách sách có filter/sort
1. Client gọi `GET /books` kèm `page`, `limit`, và có thể có `sort`, `category_id`.
2. Controller chuẩn hoá phân trang như mục 3.1.
3. Controller validate:
	- `sort` chỉ nhận `latest` hoặc `bestseller` (khác -> 400).
	- `category_id` là UUID hợp lệ (sai định dạng -> 400).
4. Service kiểm tra category tồn tại nếu có `category_id`:
	- Không tồn tại -> 404.
5. Hệ thống áp dụng filter/sort:
	- `sort=latest`: sắp xếp theo `release_date DESC NULLS LAST`, tie-break `createdAt DESC`.
	- `sort=bestseller`: aggregate all-time từ `orders` và `order_items`, chỉ tính đơn `COMPLETED`, sắp xếp theo tổng `quantity` bán ra giảm dần.
	- Nếu không có `sort`: mặc định `createdAt DESC`.
6. Kết quả trả về theo pagination (data + metadata).

## 4. Ràng buộc nghiệp vụ
- Pagination phải an toàn, không cho limit vượt quá 50.
- Chi tiết sách chỉ hợp lệ với UUID đúng định dạng.
- Query rỗng không được quăng lỗi; thay vào đó trả về danh sách rỗng.
- Search hiện tại là nghiệp vụ truy xuất, không có bước write state.
- `GET /books` hỗ trợ `sort=latest|bestseller` và `category_id`.
- `sort` không hợp lệ trả 400.
- `category_id` sai định dạng trả 400; hợp lệ nhưng không tồn tại trả 404.
- `sort=bestseller` chỉ tính đơn `COMPLETED` (all-time).
- `release_date` được phép `NULL` trong DB để tương thích dữ liệu cũ; dữ liệu `NULL` không được ưu tiên trong API latest.
- `GET /books/semantic-search` hỗ trợ `threshold` trong khoảng [0,1].
- Nếu Gemini lỗi, hệ thống fallback keyword search.

## 5. Side effect và trạng thái
- Feature này không thay đổi dữ liệu.
- Mọi thao tác đều là read-only.

## 6. Điểm cần lưu ý khi test
- page âm hoặc bằng 0 phải được chuẩn hoá về 1.
- limit lớn hơn 50 phải bị cắt xuống 50.
- id sai định dạng phải trả 400 trước khi đi vào service.
- q rỗng phải trả danh sách rỗng, không phải lỗi.
- `GET /books?sort=latest` trả kết quả theo `release_date DESC NULLS LAST` và có pagination.
- `GET /books?category_id=<uuid>` với UUID sai định dạng phải trả `400`.
- `GET /books?category_id=<uuid>` với UUID hợp lệ nhưng category không tồn tại phải trả `404`.
- `GET /books?sort=bestseller` trả danh sách theo tổng số lượng bán ra (all-time), có pagination.

## 7. File liên quan
- [src/services/BookService.ts](../../src/services/BookService.ts)
- [src/controllers/BookController.ts](../../src/controllers/BookController.ts)
- [src/routes/book.routes.ts](../../src/routes/book.routes.ts)
- [src/services/EmbeddingSearchService.ts](../../src/services/EmbeddingSearchService.ts)
- [src/services/EmbeddingProviderService.ts](../../src/services/EmbeddingProviderService.ts)
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