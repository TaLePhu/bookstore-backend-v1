# Promotion (Khuyến mãi) - Logic Nghiệp Vụ

## 1. Mục tiêu
Feature Promotion dùng để quản lý và hiển thị các chương trình khuyến mãi (banner, tiêu đề, mô tả, khoảng thời gian áp dụng) cho người dùng.

## 2. Actor và quyền truy cập
- **User (Guest & Đăng nhập)**: Có thể xem danh sách các khuyến mãi đang diễn ra.
- **Admin**: Có quyền xem danh sách toàn bộ khuyến mãi, tạo mới, cập nhật và xoá khuyến mãi. Route admin phải đi qua auth middleware và role guard.

## 3. Luồng nghiệp vụ chính

### 3.1 Xem danh sách khuyến mãi (User)
1. User gọi endpoint lấy danh sách khuyến mãi.
2. Hệ thống trả về danh sách các chương trình khuyến mãi hiện có (thường là các khuyến mãi đang active hoặc hợp lệ theo thời gian).

### 3.2 Quản lý khuyến mãi (Admin)
1. **Lấy danh sách**: Admin lấy danh sách toàn bộ khuyến mãi.
2. **Tạo khuyến mãi**: Admin gửi thông tin khuyến mãi (title, description, discountRate, startDate, endDate) cùng với file ảnh banner (bannerImage).
   - Middleware upload xử lý file ảnh, đẩy lên Cloudinary để lấy URL an toàn.
   - Trả về thông tin khuyến mãi vừa tạo.
3. **Cập nhật khuyến mãi**: Admin gửi id và các thông tin cần cập nhật. Nếu có ảnh mới, hệ thống upload ảnh mới lên Cloudinary và thay thế ảnh cũ.
4. **Xóa khuyến mãi**: Admin gửi id để xóa chương trình khuyến mãi khỏi hệ thống.

## 4. Ràng buộc nghiệp vụ
- Tạo và cập nhật khuyến mãi yêu cầu thông tin hợp lệ (tên, thời gian bắt đầu/kết thúc).
- File banner tải lên phải đúng định dạng và kích thước quy định.

## 5. Side effect và trạng thái
- Thay đổi khuyến mãi sẽ hiển thị trực tiếp lên UI (Slider/Banner) ở trang chủ của client.
- Khi xoá hoặc cập nhật banner mới, ảnh cũ trên Cloudinary nên được dọn dẹp để tiết kiệm dung lượng.

## 6. Điểm cần lưu ý khi test
- API User chỉ hiển thị khuyến mãi công khai.
- Admin thao tác tạo/sửa phải upload ảnh thành công.
- Thời gian endDate không được nhỏ hơn startDate.

## 7. File liên quan
- `src/controllers/PromotionController.ts`
- `src/services/PromotionService.ts`
- `src/controllers/AdminPromotionController.ts`
- `src/services/AdminPromotionService.ts`
- `src/entities/Promotion.ts`
