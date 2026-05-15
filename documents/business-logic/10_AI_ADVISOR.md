# AI Advisor - Logic Nghiệp Vụ

## 1. Mục tiêu
Feature AI Advisor cung cấp tính năng trò chuyện và tư vấn bằng AI (dựa trên các mô hình ngôn ngữ lớn như Gemini) để giúp người dùng tìm kiếm sách, giải đáp thắc mắc và gợi ý sách phù hợp dựa trên ngữ cảnh lịch sử trò chuyện.

## 2. Actor và quyền truy cập
- Phụ thuộc vào cấu hình route, thông thường người dùng có thể gửi câu hỏi tới hệ thống (có thể public hoặc yêu cầu đăng nhập tuỳ thuộc vào quy định hệ thống hiện tại).

## 3. Luồng nghiệp vụ chính

### 3.1 Nhận tư vấn từ AI
1. Client gọi endpoint `POST /ai-advisor/advise`.
2. Client truyền vào:
   - `question`: Câu hỏi hiện tại của người dùng.
   - `limit` (optional, mặc định 4): Số lượng gợi ý tối đa.
   - `history` (optional): Lịch sử trò chuyện trước đó (mảng các object chứa role và content).
3. Controller chuẩn hoá giá trị limit và fallback các giá trị rỗng.
4. Hệ thống chuyển câu hỏi và lịch sử trò chuyện tới `AIAdvisorService`.
5. AI Service sẽ tạo prompt kết hợp ngữ cảnh hệ thống (system prompt), lịch sử (history) và câu hỏi mới.
6. Kết quả từ AI được phân tích cú pháp (parse) và trả về cho client. Nếu có gọi công cụ tìm kiếm sách (vector/semantic search), kết quả có thể đi kèm danh sách sách (data).
7. Client nhận về câu trả lời tự nhiên của AI và danh sách các sách được gợi ý.

## 4. Ràng buộc nghiệp vụ
- Câu hỏi rỗng vẫn có thể xử lý nhưng thường trả về câu chào hỏi hoặc yêu cầu nhập lại.
- Dữ liệu `history` phải được đảm bảo đúng định dạng chuẩn mảng lịch sử trò chuyện (role: user/model, content: chuỗi).
- Limit nên có giới hạn hợp lý để không vượt quá token limit của LLM (trong hệ thống mặc định là 4).

## 5. Side effect và trạng thái
- Quá trình xử lý AI không thay đổi trạng thái của cơ sở dữ liệu hệ thống (không ghi DB).
- Khuyến nghị caching hoặc rate limit nếu lượng người dùng gọi AI lớn để tránh lạm dụng chi phí LLM.

## 6. Điểm cần lưu ý khi test
- Cần test trường hợp gửi `history` rỗng và `history` dài.
- Cần test khả năng AI trả về lỗi hoặc timeout khi gọi đến LLM provider (như Gemini). Hệ thống phải handle lỗi gracefully và không làm sập server.
- Định dạng kết quả trả về từ AI đôi khi không ổn định, cần đảm bảo hàm parse an toàn.

## 7. File liên quan
- `src/controllers/AIAdvisorController.ts`
- `src/services/AIAdvisorService.ts`
