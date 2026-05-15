# Business Logic Docs

Bộ tài liệu này mô tả logic nghiệp vụ của từng feature trong hệ thống BookStore, tập trung vào luồng xử lý thực tế trong service, ràng buộc dữ liệu, quyền truy cập, trạng thái và các side effect.

## Mục đích
- Làm rõ mỗi feature xử lý gì ở mức nghiệp vụ.
- Chỉ ra tiền điều kiện, hậu điều kiện và các quy tắc không được vi phạm.
- Hỗ trợ phát triển FE, test, review và báo cáo đồ án.

## Phạm vi tài liệu
- Auth
- User
- Address (shipping address management)
- Book và Search
- Category
- Cart
- Order
- Admin Management (User, Book, Category, Order, Promotion, Dashboard)
- Promotion
- AI Advisor

## Cách đọc
Mỗi feature doc nên có các phần sau:
- Mục tiêu nghiệp vụ
- Actor và quyền truy cập
- Luồng chính
- Luồng ngoại lệ
- Ràng buộc dữ liệu
- Trạng thái hoặc side effect
- Ghi chú kỹ thuật

## Danh sách tài liệu
- [01_AUTH.md](01_AUTH.md)
- [02_USER.md](02_USER.md)
- [03_BOOK_SEARCH.md](03_BOOK_SEARCH.md)
- [04_CATEGORY.md](04_CATEGORY.md)
- [05_CART.md](05_CART.md)
- [06_ORDER.md](06_ORDER.md)
- [07_ADMIN.md](07_ADMIN.md)
- [08_SHARED_RULES.md](08_SHARED_RULES.md)
- [09_PROMOTION.md](09_PROMOTION.md)
- [10_AI_ADVISOR.md](10_AI_ADVISOR.md)

## Ghi chú chung
- Tài liệu này ưu tiên mô tả business logic, không lặp lại toàn bộ API contract.
- Luồng có thay đổi trạng thái phải ghi rõ điều kiện đầu vào, dữ liệu bị cập nhật và dữ liệu bị huỷ/khóa.
- Các luồng liên quan tới email, token, queue, Redis, transaction hoặc stock cần được nhấn mạnh vì đây là các điểm dễ phát sinh lỗi nhất.
- Tech note liên quan Address API: `docs/tech_note/1704_Address_API_Default_Rules.md`.