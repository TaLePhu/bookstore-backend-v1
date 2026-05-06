# CHƯƠNG 1: TỔNG QUAN ĐỀ TÀI

## 1.1. Lý do chọn đề tài
Trong kỷ nguyên công nghệ số, thương mại điện tử (TMĐT) đã và đang phát triển mạnh mẽ, thay đổi hoàn toàn thói quen mua sắm của người tiêu dùng. Ngành kinh doanh sách cũng không nằm ngoài xu hướng này. So với nhà sách truyền thống, các nền tảng bán sách trực tuyến mang lại sự tiện lợi, đa dạng về đầu sách và không bị giới hạn bởi không gian, thời gian.
Tuy nhiên, với lượng sách khổng lồ, người dùng thường gặp khó khăn trong việc tìm kiếm chính xác cuốn sách mong muốn hoặc khám phá những tựa sách phù hợp với sở thích cá nhân nếu chỉ dựa vào công cụ tìm kiếm từ khóa truyền thống. Việc ứng dụng Trí tuệ nhân tạo (AI), cụ thể là công nghệ tìm kiếm theo ngữ nghĩa (Semantic Search) và hệ thống gợi ý (Recommendation System) để nâng cao trải nghiệm khách hàng đang là một nhu cầu cấp thiết.
Nhận thấy tiềm năng và yêu cầu thực tiễn đó, đề tài **"Xây dựng hệ thống cửa hàng bán sách trực tuyến có tích hợp Trí tuệ nhân tạo (AI)"** được lựa chọn nhằm giải quyết bài toán tối ưu hóa hệ thống Backend TMĐT, đồng thời mang lại trải nghiệm mua sắm thông minh và cá nhân hóa cho người dùng.

## 1.2. Mục tiêu nghiên cứu
- **Về mặt lý thuyết:** Nghiên cứu kiến trúc hệ thống Client-Server, thiết kế RESTful API, quản trị cơ sở dữ liệu quan hệ và cơ chế hoạt động của các hệ thống AI (Vector Embedding, RAG).
- **Về mặt thực tiễn:** Xây dựng thành công một hệ thống Backend mạnh mẽ, an toàn, có khả năng mở rộng cho nền tảng bán sách trực tuyến.
- **Về mặt công nghệ:** Tích hợp thành công công nghệ AI (thông qua PostgreSQL và pgvector) để cung cấp tính năng gợi ý sách và Chatbot tư vấn dựa trên ngữ nghĩa tự nhiên.

## 1.3. Đối tượng và phạm vi nghiên cứu
- **Đối tượng nghiên cứu:** Kiến trúc phần mềm Web Backend, quy trình nghiệp vụ thương mại điện tử, công nghệ lưu trữ và xử lý vector ngôn ngữ (Vector Database).
- **Phạm vi nghiên cứu:** 
  - Hệ thống tập trung xây dựng phần lõi Backend (API Server) và cơ sở dữ liệu.
  - Phục vụ các nghiệp vụ chính: quản lý người dùng, sản phẩm (sách), giỏ hàng, đơn đặt hàng và thanh toán.
  - Phạm vi AI: Giới hạn ở việc sinh và lưu trữ vector nhúng (Embeddings) để tìm kiếm độ tương đồng Cosine, áp dụng cho tính năng gợi ý và Chatbot tư vấn ngữ cảnh.

## 1.4. Phương pháp nghiên cứu
- **Phương pháp thu thập và nghiên cứu tài liệu:** Tìm hiểu lý thuyết qua sách báo, tài liệu chuyên ngành, API documentation của các công nghệ (Node.js, PostgreSQL, TypeORM, Redis...).
- **Phương pháp phân tích và thiết kế hệ thống:** Khảo sát quy trình mua bán sách thực tế, từ đó mô hình hóa cơ sở dữ liệu, thiết kế sơ đồ luồng dữ liệu (Data Flow) và kiến trúc API.
- **Phương pháp thực nghiệm:** Lập trình (Coding), triển khai môi trường thử nghiệm bằng Docker, và sử dụng công cụ Postman để kiểm thử các chức năng nghiệp vụ, đánh giá độ chính xác của mô hình AI.

## 1.5. Ý nghĩa khoa học và thực tiễn
- **Ý nghĩa khoa học:** Hệ thống hóa kiến thức về việc tích hợp mô hình AI vào kiến trúc phần mềm truyền thống mà không làm giảm hiệu năng hệ thống (sử dụng pgvector thay vì các dịch vụ Vector Database bên ngoài phức tạp).
- **Ý nghĩa thực tiễn:** Tạo ra một bộ mã nguồn (Source code) Backend hoàn chỉnh, đạt chuẩn công nghiệp, có thể ứng dụng ngay vào thực tế hoặc làm nền tảng để phát triển các dự án TMĐT quy mô lớn hơn trong tương lai.

## 1.6. Cấu trúc khóa luận
Ngoài phần Mở đầu và Kết luận, khóa luận được chia thành các chương sau:
- **Chương 1:** Tổng quan đề tài.
- **Chương 2:** Cơ sở lý thuyết và công nghệ.
- **Chương 3:** Phân tích yêu cầu và thiết kế hệ thống.
- **Chương 4:** Thiết kế hệ thống (Kiến trúc, CSDL, API).
- **Chương 5:** Cài đặt và kiểm thử hệ thống.
- **Chương 6:** Kết luận và hướng phát triển.

---

# CHƯƠNG 2: CƠ SỞ LÝ THUYẾT VÀ CÔNG NGHỆ

## 2.1. Tổng quan về thương mại điện tử
Thương mại điện tử (E-Commerce) là quá trình tiến hành các giao dịch mua bán hàng hóa, dịch vụ thông qua mạng Internet. Các hệ thống TMĐT hiện đại không chỉ đơn thuần là trang web hiển thị sản phẩm mà là một hệ sinh thái phức tạp bao gồm: quản lý kho hàng, xử lý thanh toán, quản trị quan hệ khách hàng (CRM) và logistics. Điểm mấu chốt để một hệ thống TMĐT thành công là tính ổn định, bảo mật dữ liệu người dùng và khả năng chịu tải cao.

## 2.2. Tổng quan hệ thống bán sách trực tuyến
Khác với các sản phẩm tiêu dùng thông thường, "Sách" có những thuộc tính metadata đặc thù như: Tác giả, Nhà xuất bản, Năm xuất bản, Số trang, Ngôn ngữ, và Số ISBN. Do đó, cơ sở dữ liệu của một hệ thống bán sách cần được thiết kế chặt chẽ để thể hiện đa dạng các thuộc tính này. Hành vi của khách hàng mua sách cũng thường chịu ảnh hưởng lớn bởi review (đánh giá), thể loại và các tựa sách tương tự, đòi hỏi hệ thống phải có tính năng liên kết và gợi ý chéo (Cross-selling) mạnh mẽ.

## 2.3. Cơ sở dữ liệu SQL (PostgreDB)
- **Cơ sở dữ liệu quan hệ (RDBMS):** Là hệ thống quản lý dữ liệu dựa trên mô hình quan hệ, dữ liệu được tổ chức thành các bảng có liên kết chặt chẽ với nhau thông qua khóa chính (Primary Key) và khóa ngoại (Foreign Key). Nó đảm bảo tính toàn vẹn dữ liệu qua nguyên tắc ACID (Atomicity, Consistency, Isolation, Durability).
- **PostgreSQL:** Là một hệ quản trị cơ sở dữ liệu mã nguồn mở mãnh mẽ nhất thế giới. PostgreSQL được chọn cho đồ án này nhờ khả năng xử lý giao dịch phức tạp, độ tin cậy cao và đặc biệt là khả năng mở rộng với các Extension. Nổi bật nhất trong dự án là extension `pgvector`, cho phép PostgreSQL lưu trữ và truy vấn trực tiếp dữ liệu vector đa chiều, biến nó thành một Vector Database phục vụ đắc lực cho AI.

## 2.4. Kiến trúc Web (Client – Server, RESTful API)
- **Kiến trúc Client - Server:** Tách biệt rõ ràng phần giao diện người dùng (Client) và phần xử lý logic, lưu trữ (Server). Mô hình này giúp dự án dễ dàng bảo trì, mã nguồn Backend có thể phục vụ cho nhiều nền tảng Client khác nhau (Web, Mobile App).
- **RESTful API:** Là tiêu chuẩn thiết kế API dựa trên kiến trúc REST (Representational State Transfer). RESTful sử dụng các HTTP Methods (GET, POST, PUT, DELETE) để thực hiện các thao tác CRUD lên các Resource (Tài nguyên). Việc tuân thủ REST giúp API của hệ thống trở nên mạch lạc, dễ hiểu và dễ tích hợp.

## 2.5. Tổng quan về trí tuệ nhân tạo (AI)
Trí tuệ nhân tạo trong bối cảnh ứng dụng Web hiện đại không nhất thiết phải là việc tự xây dựng và huấn luyện mô hình từ đầu (từ con số 0), mà tập trung vào việc tận dụng các mô hình Ngôn ngữ lớn (Large Language Models - LLM) đã được huấn luyện sẵn (Pre-trained) thông qua API để giải quyết các bài toán cụ thể như phân tích sắc thái, trích xuất thông tin, hoặc hiểu ngữ nghĩa văn bản.

## 2.6. Hệ thống gợi ý (Recommendation System)
Hệ thống gợi ý là một thuật toán phần mềm gợi ý các mục nội dung cụ thể cho người dùng.
- **Phương pháp Lọc theo nội dung (Content-based filtering):** Hệ thống sẽ gợi ý các sách có đặc tính giống với cuốn sách mà người dùng đang xem hoặc đã mua. 
- **Ứng dụng Vector Embeddings:** Thay vì chỉ so sánh các từ khóa (Tags/Categories), nội dung mô tả của sách sẽ được AI mã hóa thành các Vector số (Embeddings). Khi cần tìm sách tương tự, hệ thống tính toán khoảng cách (hoặc độ tương đồng Cosine) giữa các vector này. Hai vector càng gần nhau trong không gian đa chiều, nội dung của hai cuốn sách càng có ý nghĩa tương đồng.

## 2.7. Chatbot và xử lý ngôn ngữ tự nhiên (NLP)
- **Xử lý ngôn ngữ tự nhiên (NLP):** Là nhánh của AI giúp máy tính hiểu, giải thích và thao tác với ngôn ngữ của con người.
- **Kỹ thuật RAG (Retrieval-Augmented Generation):** Trong đồ án, Chatbot không chỉ trả lời dựa trên kiến thức được huấn luyện của AI (có thể bị "ảo giác" - hallucination hoặc thiếu thông tin thực tế của cửa hàng). RAG giải quyết vấn đề này bằng cách: Đầu tiên, hệ thống lấy (Retrieve) câu hỏi người dùng, tìm kiếm trong CSDL (PostgreSQL pgvector) các thông tin sách liên quan nhất. Sau đó, cung cấp các thông tin này làm ngữ cảnh (Context) cho AI sinh ra (Generate) câu trả lời cuối cùng. Điều này giúp Chatbot tư vấn chính xác sách đang có bán tại cửa hàng.

## 2.8. Các công nghệ sử dụng trong đề tài
Để hiện thực hóa các cơ sở lý thuyết trên, hệ thống Backend được xây dựng bằng hệ sinh thái công nghệ tiên tiến:
1. **Node.js & Express.js:** Nền tảng thực thi JavaScript ở phía Server, sử dụng kiến trúc Event-Driven, Non-blocking I/O giúp xử lý hàng ngàn request đồng thời với hiệu suất cao. Express.js là framework tối giản, linh hoạt để xây dựng Router và Middleware.
2. **TypeScript:** Cung cấp định kiểu tĩnh (Static Typing) cho JavaScript, giúp phát hiện lỗi ngay từ lúc viết code (compile-time) và hỗ trợ tự động gợi ý code (IntelliSense), rất quan trọng khi làm việc với hệ thống lớn và Entity phức tạp.
3. **TypeORM:** Công cụ ORM (Object-Relational Mapping) chuyên dụng cho TypeScript, giúp thao tác với PostgreSQL thông qua các Object (Lập trình hướng đối tượng) thay vì viết câu lệnh SQL thuần túy, đồng thời hỗ trợ quản lý Migration tự động.
4. **Redis & BullMQ:** 
   - **Redis:** Hệ quản trị CSDL In-memory, được dùng làm Cache (lưu trữ kết quả truy vấn), quản lý Session, và lưu trữ Whitelist Refresh Token.
   - **BullMQ:** Thư viện quản lý Message Queue dựa trên Redis, sử dụng để xử lý các tác vụ nặng chạy nền (Background Jobs) như: Gửi Email OTP, đồng bộ dữ liệu Vector, tránh làm tắc nghẽn luồng xử lý API chính của người dùng.
5. **Docker:** Công cụ container hóa giúp đóng gói PostgreSQL, pgvector và Redis thành các container, đảm bảo tính nhất quán của môi trường phát triển (Môi trường Local giống hệt môi trường Production).
