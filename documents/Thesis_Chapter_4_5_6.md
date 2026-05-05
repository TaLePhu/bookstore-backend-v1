# CHƯƠNG 4: THIẾT KẾ HỆ THỐNG

## 4.1. Kiến trúc tổng thể hệ thống
Hệ thống cửa hàng bán sách trực tuyến (BookStore) được thiết kế theo mô hình kiến trúc **Client-Server** hiện đại, kết hợp với các công nghệ tiên tiến để đảm bảo hiệu suất, khả năng mở rộng và tính bảo mật. 

Kiến trúc bao gồm các thành phần chính:
- **Client (Frontend):** Giao diện người dùng trên nền tảng Web, tương tác với người dùng cuối (Customer) và quản trị viên (Admin).
- **Server (Backend):** Hệ thống API được xây dựng bằng **Node.js** và framework **Express**, kết hợp với **TypeScript** để đảm bảo tính chặt chẽ về kiểu dữ liệu. Backend đóng vai trò xử lý logic nghiệp vụ trung tâm.
- **Database (Cơ sở dữ liệu):** Sử dụng **PostgreSQL** làm cơ sở dữ liệu quan hệ chính để lưu trữ thông tin người dùng, sách, đơn hàng. Tích hợp extension **pgvector** để lưu trữ vector nhúng (embeddings) phục vụ cho hệ thống AI.
- **Cache & Queue:** Sử dụng **Redis** để quản lý phiên đăng nhập (session/refresh token whitelist), giới hạn yêu cầu (rate limiting), cache dữ liệu thường xuyên truy cập và hỗ trợ hàng đợi (Queue) qua **BullMQ** cho các tác vụ bất đồng bộ (như gửi email).

## 4.2. Thiết kế Backend

### 4.2.1. Cấu trúc hệ thống
Hệ thống Backend áp dụng mô hình kiến trúc phân lớp **Controller-Service-Repository** (hay còn gọi là 3-tier architecture) kết hợp với Data Transfer Objects (DTO) để kiểm soát luồng dữ liệu:
- **Routes:** Định tuyến các HTTP request tới Controller tương ứng.
- **Controllers:** Chịu trách nhiệm tiếp nhận request từ Client, kiểm tra tính hợp lệ ban đầu (thông qua DTOs), gọi các Service tương ứng để xử lý và trả về HTTP response.
- **Services:** Nơi chứa toàn bộ **Logic nghiệp vụ (Business Logic)** của ứng dụng.
- **Repositories:** Lớp giao tiếp trực tiếp với cơ sở dữ liệu thông qua ORM **TypeORM**, thực hiện các thao tác truy vấn (CRUD).
- **Middlewares:** Xử lý các tác vụ trung gian như xác thực (Auth), phân quyền (Role Guard), xử lý lỗi chung.

### 4.2.2. Thiết kế API
API được thiết kế theo tiêu chuẩn **RESTful API**, sử dụng định dạng dữ liệu JSON.
- Phân tách rõ ràng các resource: `/users`, `/books`, `/categories`, `/carts`, `/orders`, `/auth`.
- Cung cấp các endpoint riêng cho Admin thông qua tiền tố `/admin/...` để quản lý hệ thống.
- Sử dụng các HTTP method chuẩn: `GET` (lấy dữ liệu), `POST` (tạo mới), `PUT/PATCH` (cập nhật), `DELETE` (xóa).
- Các API đều trả về response theo một format chuẩn mực chung, giúp Frontend dễ dàng tích hợp và xử lý lỗi.

### 4.2.3. Xác thực và phân quyền
Hệ thống triển khai cơ chế xác thực mạnh mẽ kết hợp giữa **JWT (JSON Web Token)** và **Redis**:
- **Luồng đăng nhập/Làm mới token:** Sử dụng cặp token gồm `Access Token` (thời gian sống ngắn) và `Refresh Token` (thời gian sống dài). 
- Hash của `Refresh Token` được lưu trữ an toàn trong Database và đưa vào **Redis Whitelist** gắn với `deviceId` của thiết bị đăng nhập, hỗ trợ quản lý đăng nhập đa thiết bị (multi-device).
- **Phân quyền (Role-based access control - RBAC):** Người dùng trong hệ thống được phân thành các nhóm quyền cơ bản: `GUEST`, `CUSTOMER`, `STAFF`, `ADMIN`. Mỗi API endpoint đều có middleware kiểm tra tính hợp lệ của token và quyền truy cập tương ứng.
- **Bảo mật luồng xác thực:** Mọi tài khoản mới đăng ký phải qua bước xác minh Email (sử dụng mã OTP gửi qua BullMQ). Nhập sai mã quá số lần quy định sẽ bị khóa tạm thời để chống brute-force.

---

## 4.3. Thiết kế Cơ sở dữ liệu
Cơ sở dữ liệu được thiết kế tối ưu, có chuẩn hóa cao và định nghĩa các mối quan hệ (Relations) rõ ràng thông qua TypeORM.

### 4.3.1. User Schema
Bảng `users` đóng vai trò cốt lõi trong việc định danh người dùng.
- **Các trường chính:** `id` (UUID), `userName`, `fullName`, `email` (Unique), `passwordHash` (ẩn khi truy vấn), `role`, `isVerified`, `isLocked`.
- **Quan hệ:** Có liên kết `OneToMany` tới các bảng `addresses` (địa chỉ giao hàng), `carts`, `orders`, `reviews`, `behaviors` và `refreshTokens`. Liên kết `OneToOne` tới `user_advances` để mở rộng thông tin cá nhân (ảnh đại diện, ngày sinh, giới tính).

### 4.3.2. Book Schema
Bảng `books` lưu trữ toàn bộ thông tin về sản phẩm sách.
- **Các trường chính:** `id` (UUID), `title`, `author`, `description`, `price`, `stock` (tồn kho), `soldCount` (số lượng đã bán - phục vụ thống kê), `isbn` (Unique). Mở rộng thêm các thông tin: `publisher`, `publishYear`, `pages`, `format`, v.v.
- **Quan hệ:** Thuộc về 1 `Category` (`ManyToOne`). Có quan hệ `OneToMany` tới `reviews` (đánh giá), `book_images` (hình ảnh), và đặc biệt là `embeddings` (lưu vector ngữ nghĩa).

### 4.3.3. Category Schema
Bảng `categories` phân loại danh mục các đầu sách.
- **Các trường chính:** `id` (UUID), `name` (Unique), `description`.
- **Quan hệ:** `OneToMany` tới `books`. Khi truy vấn sách, có thể dễ dàng join để lấy tên danh mục tương ứng.

### 4.3.4. Cart Schema
Quản lý giỏ hàng của người dùng, phân tách thành 2 bảng để theo dạng Header - Line.
- **Cart (`carts`):** Mỗi User có thể có giỏ hàng, chứa `id`, `user_id`.
- **CartItem (`cart_items`):** Lưu trữ chi tiết từng sản phẩm trong giỏ: `id`, `cart_id`, `book_id`, `quantity`. Có Unique constraint giữa `cart_id` và `book_id` để tránh việc thêm trùng lặp một quyển sách thành 2 dòng trong giỏ hàng.

### 4.3.5. Order Schema
Quản lý vòng đời của đơn đặt hàng từ lúc đặt mua đến khi hoàn tất.
- **Order (`orders`):** Lưu trữ thông tin tổng quát gồm `id`, `orderCode`, `totalAmount`, `shippingFee`, `note`, `status` (Enum: PENDING, PROCESSING, SHIPPED, COMPLETED, CANCELLED), `user_id`, `address_id`.
- **OrderItem (`order_items`):** Chi tiết đơn hàng, liên kết `order_id` với `book_id` cùng giá tiền và số lượng tại thời điểm đặt (tránh việc thay đổi giá sách ảnh hưởng đến lịch sử đơn hàng).
- **Payment (`payments`):** Liên kết với Order để lưu trữ thông tin giao dịch thanh toán.

---

## 4.4. Thiết kế Frontend

*(Ghi chú: Mô tả tổng quát về hướng thiết kế cho phần giao diện của đồ án)*

### 4.4.1. Giao diện người dùng
Giao diện người dùng (UI) được thiết kế theo phong cách hiện đại, thân thiện, và tối ưu hóa trải nghiệm trên mọi kích thước màn hình (Responsive Design).
- Áp dụng các nguyên tắc thiết kế như: sử dụng khoảng trắng hợp lý, phân cấp thông tin rõ ràng bằng typography, hỗ trợ Dark/Light mode để tạo sự thoải mái cho người dùng.
- Giao diện cung cấp phản hồi hình ảnh nhanh chóng (micro-interactions) như hiệu ứng hover, loading skeletons để người dùng không có cảm giác phải chờ đợi.

### 4.4.2. Điều hướng hệ thống
Trải nghiệm người dùng (UX) được tập trung xây dựng thông qua luồng điều hướng mượt mà:
- **Trang chủ:** Trưng bày các sách nổi bật, sách bán chạy và gợi ý theo sở thích.
- **Danh mục & Tìm kiếm:** Thanh tìm kiếm đa dạng, bộ lọc theo giá, thể loại, tác giả hỗ trợ người mua nhanh chóng tiếp cận cuốn sách mong muốn.
- **Giỏ hàng & Thanh toán:** Luồng checkout rút gọn, rõ ràng, minh bạch về phí vận chuyển và tổng tiền, cho phép chọn/thêm địa chỉ giao hàng linh hoạt.
- **Quản lý tài khoản (Dashboard):** Nơi người dùng theo dõi lịch sử đơn hàng, cập nhật hồ sơ và địa chỉ.
- **Trang Admin:** Một trang quản trị riêng biệt cho phép thống kê doanh thu, quản lý người dùng, sách và đơn hàng một cách trực quan thông qua bảng biểu (Data tables) và biểu đồ (Charts).

---

## 4.5. Thiết kế hệ thống AI
Hệ thống tích hợp các mô hình Trí tuệ nhân tạo (AI) giúp cá nhân hóa trải nghiệm người dùng và cung cấp công cụ tìm kiếm ngữ nghĩa sâu.

### 4.5.1. Mô hình gợi ý sách
- **Thu thập dữ liệu hành vi:** Bảng `UserBehavior` (lưu trữ các hành động như VIEW, CLICK, ADD_TO_CART, PURCHASE, WISHLIST) được sử dụng để theo dõi thói quen và sở thích của người dùng.
- **Nhúng ngữ nghĩa (Embeddings):** Sử dụng các mô hình ngôn ngữ lớn để biến đổi nội dung mô tả, tiêu đề và metadata của sách thành các vector đa chiều. Các vector này được lưu trong bảng `embeddings` với kiểu dữ liệu `vector(1536)` (thông qua `pgvector`).
- **Cơ chế gợi ý:** Khi người dùng xem một cuốn sách, hệ thống sử dụng thuật toán tính toán độ tương đồng cosine (Cosine Similarity) trong CSDL để nhanh chóng tìm ra các đầu sách có ngữ nghĩa tương đồng nhất để gợi ý.

### 4.5.2. Chatbot tư vấn
- Ứng dụng kỹ thuật **RAG (Retrieval-Augmented Generation)** để xây dựng trợ lý ảo tư vấn sách.
- Khi người dùng đặt câu hỏi tự nhiên (ví dụ: "Tôi muốn tìm một cuốn tiểu thuyết trinh thám li kì"), hệ thống sẽ chuyển đổi câu hỏi thành vector, truy xuất các sách có vector gần giống nhất trong CSDL, và đưa thông tin đó vào làm ngữ cảnh cho AI sinh ngôn ngữ tổng hợp câu trả lời tư vấn chính xác.

### 4.5.3. Luồng xử lý AI 
1. **Tiền xử lý & Tạo Vector:** Mỗi khi một cuốn sách mới được thêm vào hoặc cập nhật, một tác vụ nền sẽ gọi API của mô hình AI để sinh vector embedding và lưu vào `pgvector`.
2. **Khớp nối (Matching):** Truy vấn người dùng được vector hóa theo thời gian thực và so khớp với kho vector của hệ thống để trả về Top-K kết quả liên quan.
3. **Phản hồi:** Trả về kết quả trực tiếp cho chức năng tìm kiếm thông minh hoặc cung cấp ngữ cảnh cho Chatbot sinh câu trả lời tự nhiên.

---

# CHƯƠNG 5: CÀI ĐẶT VÀ KIỂM THỬ HỆ THỐNG

## 5.1. Môi trường và công cụ cài đặt
Để phát triển và triển khai hệ thống, các công cụ và công nghệ sau đã được sử dụng:
- **Ngôn ngữ & Runtime:** TypeScript, Node.js.
- **Framework:** Express.js cho việc khởi tạo HTTP Server.
- **Cơ sở dữ liệu:** PostgreSQL (lưu dữ liệu chính), Redis (quản lý session, cache, hàng đợi).
- **ORM:** TypeORM để map logic object sang database.
- **Công cụ hỗ trợ:** Docker (đóng gói môi trường Redis, Postgres để chạy local), Postman (kiểm thử API), BullMQ (quản lý job queue).

## 5.2. Cấu trúc chương trình
Mã nguồn Backend (`src`) được tổ chức theo cấu trúc chuẩn, dễ bảo trì:
- `/config`: Các file cấu hình biến môi trường, kết nối DB.
- `/controllers`: Tiếp nhận request, xử lý luồng giao tiếp với client.
- `/dtos`: Định nghĩa kiểu dữ liệu truyền vào/ra cho các endpoint.
- `/entities`: Định nghĩa Schema cơ sở dữ liệu.
- `/middlewares`: Chứa logic xác thực JWT, phân quyền, xử lý lỗi chung.
- `/repositories`: Chứa các hàm truy vấn DB custom ngoài các hàm chuẩn của TypeORM.
- `/routes`: Khai báo và gom nhóm các đường dẫn API.
- `/services`: Xử lý logic nghiệp vụ trung tâm.
- `/migrations` & `/seeds`: Chứa kịch bản tạo bảng DB và dữ liệu mẫu.

## 5.3. Giao diện và chức năng chính của chương trình
Mặc dù là phần Backend, chương trình cung cấp nền tảng vững chắc cho mọi chức năng Frontend:
- **Chức năng Khách hàng:** Duyệt danh mục sách, tìm kiếm sách thông thường và tìm kiếm ngữ nghĩa AI, thêm vào giỏ hàng, đặt hàng thanh toán, quản lý địa chỉ, đánh giá sách.
- **Chức năng Admin:** Quản trị toàn bộ danh mục, quản lý người dùng (khóa/mở khóa), theo dõi và cập nhật trạng thái đơn hàng (từ PENDING đến COMPLETED).
- **Chức năng Hệ thống:** Tự động gửi email xác thực khi đăng ký, quản lý an toàn vòng đời Token (cấp phát, làm mới, thu hồi token).

## 5.4. Kết quả kiểm thử
Hệ thống API đã được kiểm thử toàn diện trên công cụ **Postman**:
- **Kiểm thử Luồng xác thực (Auth Flow):** Xác nhận việc đăng ký tài khoản tự động sinh OTP, mã hóa mật khẩu; Đăng nhập trả về Token chuẩn xác; Refresh token tự động khóa phiên làm việc cũ để tăng cường bảo mật.
- **Kiểm thử Nghiệp vụ (Business flow):** Chức năng giỏ hàng chỉ cho phép thêm sách khi còn hàng (`stock > 0`), cộng dồn số lượng nếu sách đã có. Chức năng đặt hàng (Checkout) thành công trừ trực tiếp số lượng tồn kho và tăng số lượt bán (`soldCount`) trong 1 Transaction nguyên tử để đảm bảo không sai lệch dữ liệu.
- **Kiểm thử AI:** Các API nhúng vector lưu trữ thành công vào Postgres và cho kết quả tìm kiếm cosine similarity chuẩn xác với các yêu cầu truy vấn mô phỏng.

## 5.5. Đánh giá hệ thống
- **Ưu điểm:** Kiến trúc sáng sủa, phân tách rõ ràng trách nhiệm các lớp. Hệ thống có khả năng mở rộng tốt do việc tận dụng Redis làm cache và quản lý queue. Áp dụng AI trực tiếp bằng `pgvector` giúp tối ưu hóa hệ thống mà không cần dùng dịch vụ vector database bên ngoài tốn kém.
- **Nhược điểm:** Hệ thống hiện tại theo cấu trúc Monolithic, nếu số lượng truy cập quá lớn có thể sẽ là điểm nghẽn, cần phải xem xét chia nhỏ thành Microservices trong tương lai. Tính năng AI còn phụ thuộc vào API của bên thứ 3 (như OpenAI) để sinh embeddings, có độ trễ qua mạng.

## 5.6. Kết luận chương 5
Chương này đã trình bày chi tiết về quá trình triển khai mã nguồn, cấu trúc của hệ thống, cũng như việc cài đặt và kiểm thử để đảm bảo mọi tính năng Backend hoạt động đúng đắn. Nhờ việc áp dụng các công nghệ hiện đại, kết quả kiểm thử cho thấy API đáp ứng tốt, nhanh và chính xác mọi logic nghiệp vụ từ đơn giản (quản lý sách) đến phức tạp (giao dịch mua hàng đa luồng, AI).

---

# CHƯƠNG 6: KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

## 6.1. Kết quả đạt được
Đồ án đã hoàn thành mục tiêu xây dựng một nền tảng bán sách trực tuyến toàn diện, mang lại nhiều giá trị thực tiễn:
1. Xây dựng thành công hệ thống Backend mạnh mẽ, xử lý dữ liệu phức tạp của một hệ thống thương mại điện tử với độ an toàn cao.
2. Thiết kế Cơ sở dữ liệu chuẩn hóa tối ưu hóa cho truy vấn nhanh.
3. Tích hợp thành công giải pháp AI để đưa ra gợi ý sách và tìm kiếm thông minh thông qua công nghệ Embedding vector.
4. Xây dựng cơ chế bảo mật xác thực (JWT + Redis Session) chuyên nghiệp.

## 6.2. Ưu điểm của hệ thống
- **Hiệu năng và Ổn định:** Sử dụng Node.js kết hợp Redis mang lại khả năng xử lý đồng thời lượng truy cập lớn một cách mượt mà.
- **Trải nghiệm thông minh:** Chức năng tìm kiếm và gợi ý bằng AI giúp người dùng tìm kiếm sản phẩm phù hợp nhanh chóng hơn các hệ thống lọc truyền thống.
- **An toàn Dữ liệu:** Sử dụng Transaction cho các nghiệp vụ thanh toán/đặt hàng bảo vệ tính toàn vẹn của dữ liệu trong mọi hoàn cảnh lỗi.

## 6.3. Hạn chế của hệ thống
- Hệ thống khuyến nghị (Recommendation System) mới chỉ dừng lại ở mức tìm kiếm dựa trên nội dung (Content-based filtering qua Embedding vector), chưa hoàn toàn khai thác được thuật toán lọc cộng tác (Collaborative filtering) chuyên sâu để tối ưu cá nhân hóa.
- Quản lý tài nguyên media (hình ảnh) chưa được tích hợp triệt để lên các Cloud Storage (như AWS S3) mà mới xử lý cục bộ.

## 6.4. Hướng phát triển
Để hoàn thiện và biến sản phẩm thành một ứng dụng thương mại thực tế, những hướng phát triển trong tương lai bao gồm:
1. Tích hợp cổng thanh toán trực tuyến thực tế (VNPay, Momo, ZaloPay).
2. Xây dựng hệ thống Data Warehouse để phân tích hành vi người dùng bằng Machine Learning nhằm tối ưu hóa chiến dịch Marketing.
3. Chuyển đổi một phần cấu trúc Backend sang Microservices nếu cần mở rộng quy mô phục vụ lượng lớn khách hàng.
4. Phát triển thêm phiên bản ứng dụng di động (Mobile App) dùng chung một hệ thống API Backend này.

---

# TÀI LIỆU THAM KHẢO VÀ PHỤ LỤC

**Tài liệu tham khảo**
1. Documentations của Node.js, Express.js và TypeORM.
2. Tài liệu thiết kế RESTful API tiêu chuẩn.
3. Hướng dẫn sử dụng Redis trong quản lý session và caching.
4. Tài liệu kĩ thuật về PostgreSQL và extension pgvector.
5. Các tài liệu khoa học liên quan đến Retrieval-Augmented Generation (RAG) và mô hình Embedding vector.

**Phụ lục**
- Phụ lục 1: Hướng dẫn cài đặt và thiết lập môi trường (.env, Docker setup).
- Phụ lục 2: Cấu trúc thư mục chi tiết (Directory Tree).
- Phụ lục 3: Bảng danh sách các API endpoint chính của hệ thống.
- Phụ lục 4: Kịch bản kiểm thử (Test cases) chi tiết trên Postman.
