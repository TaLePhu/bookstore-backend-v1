# CHƯƠNG 3: PHÂN TÍCH VÀ ĐẶC TẢ HỆ THỐNG 

## 3.1. Tổng quan hệ thống đề xuất
Hệ thống cửa hàng bán sách trực tuyến (BookStore) đề xuất được thiết kế nhằm mục đích cung cấp một nền tảng thương mại điện tử toàn diện, hiện đại và thông minh. Thay vì chỉ hiển thị danh mục sách một cách thụ động, hệ thống đóng vai trò như một "trợ lý ảo", thấu hiểu nhu cầu của người dùng để đưa ra các gợi ý cá nhân hóa và hỗ trợ tìm kiếm theo ngữ nghĩa thay vì chỉ khớp từ khóa cứng nhắc.

Hệ thống xoay quanh ba nhóm đối tượng (Actor) chính:
- **Khách vãng lai (Guest):** Những người dùng truy cập vào hệ thống nhưng chưa đăng nhập. Họ có thể duyệt xem sách, tìm kiếm sách, đọc đánh giá và tương tác với chatbot.
- **Khách hàng (Customer):** Những người dùng đã đăng ký tài khoản và xác thực email thành công. Ngoài quyền hạn của Guest, họ có thể quản lý giỏ hàng, thực hiện quy trình thanh toán (đặt hàng), theo dõi lịch sử mua hàng và quản lý thông tin/địa chỉ cá nhân.
- **Quản trị viên (Admin/Staff):** Người điều hành hệ thống, có quyền quản trị toàn bộ dữ liệu bao gồm: quản lý danh mục, sách, duyệt đơn hàng, thống kê doanh thu và quản lý tài khoản khách hàng.

Hệ thống hoạt động dựa trên luồng dữ liệu trung tâm: từ việc thu thập hành vi người dùng (Click, View, Add to Cart), xử lý đồng bộ giao dịch mua bán, đến việc tự động cập nhật kho dữ liệu Vector AI để ngày càng cải thiện độ chính xác của các gợi ý.

## 3.2. Phân tích yêu cầu hệ thống

### 3.2.1. Yêu cầu chức năng
Yêu cầu chức năng (Functional Requirements) xác định những công việc mà hệ thống bắt buộc phải thực hiện được. Dựa trên phân tích nghiệp vụ, các chức năng được chia thành các phân hệ chính sau:

**A. Phân hệ Xác thực và Tài khoản (Auth & User Module)**
- **Đăng ký và Xác thực:** Cho phép người dùng đăng ký tài khoản mới bằng Email và Mật khẩu. Hệ thống phải gửi mã OTP qua Email để xác minh (thông qua BullMQ) trước khi cho phép kích hoạt tài khoản.
- **Đăng nhập và Bảo mật phiên:** Hỗ trợ đăng nhập bằng Email/Password, cấp phát Access Token và Refresh Token. Cần có cơ chế quản lý danh sách thiết bị (multi-device) bằng Redis để hỗ trợ đăng xuất an toàn trên từng thiết bị.
- **Quản lý hồ sơ:** Người dùng có thể cập nhật thông tin cá nhân (Tên, Ảnh đại diện, Ngày sinh) và quản lý sổ địa chỉ giao hàng (Thêm, Sửa, Xóa, Thiết lập mặc định).

**B. Phân hệ Sách và Tìm kiếm (Book & Search Module)**
- **Quản lý Danh mục:** Phân loại sách theo các danh mục khác nhau.
- **Duyệt và Tìm kiếm sách:** Cho phép người dùng duyệt sách theo danh mục, lọc theo giá, xem chi tiết sách (tác giả, mô tả, nhà xuất bản, số trang...).
- **Tìm kiếm thông minh (AI Semantic Search):** Hệ thống không chỉ tìm kiếm theo "tựa sách" hay "tác giả" mà cho phép người dùng nhập các câu tự nhiên (VD: "sách về lịch sử thế chiến"). Hệ thống tự phân tích vector để trả về kết quả liên quan nhất.
- **Hệ thống đánh giá:** Cho phép khách hàng đã mua sách được phép để lại đánh giá (Review/Rating).

**C. Phân hệ Giỏ hàng và Thanh toán (Cart & Order Module)**
- **Giỏ hàng:** Cho phép khách hàng thêm, sửa số lượng, hoặc xóa sách khỏi giỏ. Hệ thống phải tự động kiểm tra số lượng tồn kho (Stock) khi thêm vào giỏ. Nếu sản phẩm đã tồn tại trong giỏ thì tăng số lượng.
- **Đặt hàng (Checkout):** Xác nhận địa chỉ giao hàng, tính toán phí vận chuyển (Shipping Fee) và tổng tiền. Khi đặt hàng thành công, hệ thống phải trừ số lượng tồn kho của sách và dọn dẹp giỏ hàng.
- **Quản lý đơn hàng:** Khách hàng có thể xem lịch sử các đơn đã đặt và trạng thái hiện tại (PENDING, PROCESSING, SHIPPED, COMPLETED, CANCELLED).

**D. Phân hệ Quản trị (Admin Module)**
- **Quản lý người dùng:** Xem danh sách, tìm kiếm, cấp quyền hoặc khóa (Lock) tài khoản có hành vi bất thường.
- **Quản lý Sản phẩm:** Thêm mới, cập nhật thông tin, giá cả, số lượng tồn kho của Sách và Danh mục.
- **Quản lý Đơn hàng:** Cập nhật trạng thái đơn hàng (ví dụ: Chuyển từ Đang xử lý sang Đã giao hàng).

**E. Phân hệ Trí tuệ nhân tạo (AI Module)**
- **Gợi ý sách:** Thu thập hành vi người dùng (UserBehavior) để phân tích, kết hợp với độ tương đồng vector (Vector Embeddings) để gợi ý các sách tương tự dưới mỗi trang chi tiết sản phẩm.
- **Chatbot Tư vấn (RAG):** Cung cấp giao diện chat để người dùng hỏi đáp về sách. Chatbot sẽ trích xuất dữ liệu thực tế từ CSDL để đưa ra câu trả lời tự nhiên, chính xác.

### 3.2.2. Yêu cầu phi chức năng
Yêu cầu phi chức năng (Non-Functional Requirements) quy định về chất lượng, hiệu năng và các ràng buộc kỹ thuật của hệ thống.

- **Hiệu năng và Tốc độ (Performance):** 
  - Hệ thống API phải phản hồi nhanh, độ trễ lý tưởng dưới 500ms cho các truy vấn thông thường.
  - Sử dụng **Redis** để cache các kết quả truy vấn thường xuyên (như danh sách sách nổi bật, chi tiết danh mục) nhằm giảm tải cho CSDL chính PostgreSQL.
  - Tác vụ gửi email hoặc tính toán vector AI phải được đưa vào **Background Queue** (BullMQ) để không chặn (block) luồng xử lý chính của người dùng.
- **Bảo mật (Security):**
  - Mật khẩu người dùng phải được băm (hash) bằng các thuật toán mạnh (như bcrypt) trước khi lưu vào cơ sở dữ liệu. Không lưu trữ mật khẩu dưới dạng văn bản thô (plaintext).
  - Tất cả các API yêu cầu xác thực phải được bảo vệ bằng JWT và đối chiếu với Whitelist trên Redis.
  - Phân quyền chặt chẽ (Role-based access control), Admin API phải chặn tuyệt đối các request từ Customer.
  - Ngăn chặn tấn công Brute-force: Giới hạn số lần nhập sai mã xác thực OTP (ví dụ: khóa tạm thời sau 5 lần nhập sai).
- **Tính toàn vẹn dữ liệu (Data Integrity):**
  - Các thao tác liên quan đến thanh toán và cập nhật tồn kho (Stock) bắt buộc phải nằm trong **Transaction** của hệ quản trị CSDL. Đảm bảo nguyên tắc nguyên tử: Nếu luồng thanh toán gặp lỗi ở bất kỳ bước nào, toàn bộ quá trình phải được rollback (hoàn tác) để tránh tình trạng trừ tiền mà chưa tạo đơn hàng hoặc trừ kho sai.
- **Khả năng mở rộng và triển khai (Scalability & Deployment):**
  - Backend phải được thiết kế dưới dạng Stateless (không lưu trạng thái ở biến cục bộ của server), giúp dễ dàng chạy nhiều instance (container) đồng thời khi cần mở rộng quy mô.
  - Triển khai môi trường đồng nhất bằng **Docker**, đảm bảo hệ thống có thể chạy dễ dàng trên nhiều môi trường (Local, Staging, Production).
- **Trải nghiệm người dùng (Usability):**
  - Hệ thống API phải trả về các mã lỗi (HTTP Status Codes) và thông báo lỗi rõ ràng, nhất quán để Frontend có thể dễ dàng hiển thị thông báo thân thiện cho người dùng cuối. 
