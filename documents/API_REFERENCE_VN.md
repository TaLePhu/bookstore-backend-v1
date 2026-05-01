# Tài Liệu API BookStore (Tiếng Việt)

Tài liệu này là nguồn chính để frontend-backend giao tiếp.

## 1) Tổng quan

- Base URL: `http://localhost:3000/api/v1`
- Health check: `GET /health`
- Auth: Bearer token cho các endpoint protected.
- Định dạng response cố gắng đồng nhất theo `{ success, data, message }`.

## 2) Xác thực

### Header access token

```http
Authorization: Bearer <accessToken>
```

### Luồng cơ bản

1. Đăng ký (`/auth/register`)
2. Xác thực email (`/auth/verify-email`) hoặc gửi lại mã (`/auth/resend-code`)
3. Đăng nhập (`/auth/login`)
4. Làm mới token (`/auth/refresh-token`)
5. Đăng xuất (`/auth/logout`)

### Ghi chú rate limit

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh-token`, `POST /auth/resend-code`:
  - 10 requests / 15 phút / IP
- `POST /auth/verify-email`:
  - 5 requests / 15 phút / IP

## 3) Chuẩn response và lỗi

### Success response (mẫu)

```json
{
  "success": true,
  "data": {},
  "message": "Success"
}
```

### Error response (mẫu)

```json
{
  "success": false,
  "message": "Error message",
  "data": {}
}
```

### HTTP status thường gặp

- `200`: OK
- `201`: Created
- `400`: Bad request / validation
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not found
- `409`: Conflict
- `429`: Too many requests
- `500`: Internal server error

## 4) Ma trận endpoint cho frontend

### 4.1 Auth

| Method | Path | Auth | Body | Mô tả |
|---|---|---|---|---|
| POST | /auth/register | No | `userName`, `email`, `password` | Đăng ký tài khoản mới |
| POST | /auth/verify-email | No | `email`, `code` | Xác thực email bằng mã 6 ký tự |
| POST | /auth/resend-code | No | `email` | Gửi lại mã xác thực |
| POST | /auth/login | No | `email`, `password` | Đăng nhập, trả về token |
| POST | /auth/refresh-token | No | `refreshToken`, `deviceId` | Cấp access token mới (rotate refresh token) |
| POST | /auth/logout | Yes | none | Đăng xuất người dùng hiện tại |

### 4.2 Books

| Method | Path | Auth | Query | Mô tả |
|---|---|---|---|---|
| GET | /books | No | `page`, `limit`, `sort?`, `category_id?` | Danh sách sách có phân trang (hỗ trợ sort, lọc theo danh mục) |
| GET | /books/search | No | `q`, `page`, `limit` | Tìm kiếm sách |
| GET | /books/:id | No | none | Chi tiết sách theo UUID |

Ghi chú cho Books API mới:
- `GET /books` hỗ trợ query:
  - `sort=latest`: sắp xếp theo `release_date DESC NULLS LAST`, tie-break `createdAt DESC`.
  - `sort=bestseller`: sắp xếp theo tổng số lượng bán ra (all-time), chỉ tính đơn `COMPLETED`.
  - `category_id`: lọc theo danh mục.
- `sort` không hợp lệ trả `400`.
- `category_id` sai UUID trả `400`, UUID hợp lệ nhưng category không tồn tại trả `404`.

### 4.3 Categories

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | /categories | No | Danh sách thể loại sách |

### 4.4 Cart (protected)

| Method | Path | Auth | Body | Mô tả |
|---|---|---|---|---|
| GET | /cart | Yes | none | Lấy giỏ hàng của user |
| POST | /cart/add | Yes | `bookId`, `quantity` | Thêm sách vào giỏ |
| PUT | /cart/update/:itemId | Yes | `quantity` | Cập nhật số lượng item |
| DELETE | /cart/remove/:itemId | Yes | none | Xóa item khỏi giỏ |

### 4.5 Orders (protected)

| Method | Path | Auth | Body/Query | Mô tả |
|---|---|---|---|---|
| POST | /orders | Yes | Body: `addressId?`, `cartItemIds?`, `country?`, `provinceCode?`, `provinceName?`, `districtCode?`, `districtName?`, `wardCode?`, `wardName?`, `addressLine?`, `phone?`, `receiverName?`, `paymentMethod?`, `shippingFee?`, `note?` | Tạo đơn hàng từ giỏ (hỗ trợ checkout toàn bộ hoặc từng phần) |
| GET | /orders/my | Yes | Query: `page`, `limit` | Danh sách đơn của tôi |
| GET | /orders/:id | Yes | none | Chi tiết đơn của tôi |

Ghi chú cho `POST /orders`:
- Có thể checkout toàn bộ giỏ (không truyền `cartItemIds`) hoặc checkout từng phần (truyền `cartItemIds`).
- Rule địa chỉ: cần có `addressId` hoặc đủ bộ inline address tối thiểu `addressLine`, `phone`, `receiverName`.
- `paymentMethod` hỗ trợ: `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `WALLET`, `COD` (mặc định `COD`).

### 4.6 Users (protected)

| Method | Path | Auth | Body | Mô tả |
|---|---|---|---|---|
| GET | /users/me | Yes | none | Thông tin cá nhân |
| PATCH | /users/me | Yes | `avatar?`, `fullName?`, `dob?`, `gender?`, `phone?` | Cập nhật profile |
| PUT | /users/change-password | Yes | `oldPassword`, `newPassword` | Đổi mật khẩu |

### 4.7 Admin (protected + role ADMIN)

| Method | Path | Auth | Body/Query | Mô tả |
|---|---|---|---|---|
| GET | /admin/users | Yes (ADMIN) | Query: `role?`, `email?`, `full_name?`, `page?`, `limit?` | Danh sách user có bộ lọc |
| PATCH | /admin/users/:id/status | Yes (ADMIN) | Body: `isLocked` | Khóa/mở khóa tài khoản |
| PATCH | /admin/users/:id/role | Yes (ADMIN) | Body: `role` | Cấp role cho user |
| POST | /admin/users/:id/reset-password | Yes (ADMIN) | Body: `newPassword` | Đặt lại mật khẩu user |
| GET | /admin/customers/:id/summary | Yes (ADMIN) | none | Tổng quan khách hàng |

### 4.8 Addresses (protected)

| Method | Path | Auth | Body/Query | Mô tả |
|---|---|---|---|---|
| POST | /addresses | Yes | Body: `receiverName`, `phone`, `addressLine`, `country`, `provinceCode`, `provinceName`, `districtCode`, `districtName`, `wardCode`, `wardName`, `isDefault?` | Tạo địa chỉ giao hàng mới |
| GET | /addresses | Yes | none | Danh sách địa chỉ giao hàng của user |
| GET | /addresses/:id | Yes | none | Chi tiết địa chỉ giao hàng |
| PATCH | /addresses/:id | Yes | Body: đầy đủ field địa chỉ + `isDefault?` | Cập nhật địa chỉ giao hàng |
| DELETE | /addresses/:id | Yes | none | Xóa địa chỉ giao hàng |

Ghi chú cho Address API:
- Địa chỉ đầu tiên của user sẽ tự động là mặc định.
- Mỗi user chỉ có tối đa 1 địa chỉ mặc định tại một thời điểm.
- Không được xóa địa chỉ mặc định.
- Không được xóa khi user chỉ còn 1 địa chỉ.

## 5) Validation rules chính

### Auth

- Register:
  - `userName`: min 2, max 255
  - `email`: valid email
  - `password`: min 8, max 255, phải có chữ thường + chữ hoa + số
- Verify email:
  - `code`: đúng 6 ký tự
- Refresh token:
  - `deviceId`: UUID hợp lệ

### Cart

- Add to cart:
  - `bookId`: UUID v4
  - `quantity`: integer, >= 1
- Update cart item:
  - `quantity`: integer, >= 1

### Books

- `GET /books/:id`:
  - `id`: UUID hợp lệ
  - Sai định dạng UUID -> `400`
- `GET /books`:
  - `sort` chỉ nhận `latest` hoặc `bestseller` (khác -> `400`)
  - `category_id` là UUID hợp lệ, sai định dạng -> `400`
  - `category_id` hợp lệ nhưng không tồn tại -> `404`
  - `sort=bestseller` chỉ tính đơn `COMPLETED` (all-time)

### Order

- `addressId`: UUID v4 (optional)
- `cartItemIds`: Array UUID v4 (optional, để trống = checkout toàn bộ cart)
- Inline address:
  - Nếu không truyền `addressId` thì bắt buộc có `addressLine`, `phone`, `receiverName`
  - Có thể truyền thêm `country`, `provinceCode`, `provinceName`, `districtCode`, `districtName`, `wardCode`, `wardName`
- `paymentMethod`: enum (`CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `WALLET`, `COD`)
- `shippingFee` (optional): number >= 0
- `note` (optional): string max 500

### User

- Update profile:
  - `fullName`: min 2, max 255 (optional)
  - `dob`: valid date string (optional)
- Change password:
  - `newPassword`: min 6, max 255

### Address

- Create/Update:
  - `receiverName`: string, min 2, max 255
  - `phone`: string, max 20
  - `addressLine`: string, max 500
  - `country`: string, max 100
  - `provinceCode`: string, max 50
  - `provinceName`: string, max 100
  - `districtCode`: string, max 50
  - `districtName`: string, max 100
  - `wardCode`: string, max 50
  - `wardName`: string, max 100
  - `isDefault` (optional): boolean
- Rule nghiệp vụ:
  - Xóa địa chỉ mặc định -> `400`.
  - Xóa khi chỉ còn một địa chỉ -> `400`.

### Admin

- Update status: `isLocked` phải là boolean
- Update role: `role` trong enum (`ADMIN`, `STAFF`, `CUSTOMER`, `GUEST`) Note: Bỏ 'Guest'
- Reset password: min 8 và phải có chữ hoa + chữ thường + số

## 6) Ví dụ request nhanh

### Login

```http
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "user1@example.com",
  "password": "Ptest123"
}
```

### Refresh token

```http
POST {{baseUrl}}/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "<refreshToken>",
  "deviceId": "<uuid>"
}
```

### Get latest books

```http
GET {{baseUrl}}/books?sort=latest
```

### Get best-seller books

```http
GET {{baseUrl}}/books?sort=bestseller
```

### Get books by category

```http
GET {{baseUrl}}/books?category_id=<uuid>
```

### Get books by category

```http
GET {{baseUrl}}/books/category/9166b665-fb29-4383-a8ea-6c4efaaf44b1
```

### Get best-sellers books

```http
GET {{baseUrl}}/books/best-sellers
```

### Add to cart

```http
POST {{baseUrl}}/cart/add
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "bookId": "9166b665-fb29-4383-a8ea-6c4efaaf44b1",
  "quantity": 2
}
```

### Create order

```http
POST {{baseUrl}}/orders
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "cartItemIds": [
    "uuid-cua-cart-item-1",
    "uuid-cua-cart-item-2"
  ],
  "country": "VN",
  "provinceName": "Ho Chi Minh",
  "districtName": "Quan 1",
  "wardName": "Ben Nghe",
  "addressLine": "123 Duong So 1, Chung cu B",
  "phone": "0901234567",
  "receiverName": "Nguyen Van A",
  "paymentMethod": "COD",
  "shippingFee": 30000,
  "note": "Giao vao gio hanh chinh"
}
```

### Create address

```http
POST {{baseUrl}}/addresses
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "receiverName": "Nguyen Van A",
  "phone": "0901234567",
  "addressLine": "123 Duong So 1",
  "country": "VN",
  "provinceCode": "79",
  "provinceName": "Ho Chi Minh",
  "districtCode": "760",
  "districtName": "Quan 1",
  "wardCode": "26734",
  "wardName": "Ben Nghe"
}
```

### Set default address

```http
PATCH {{baseUrl}}/addresses/{{addressId}}
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "receiverName": "Nguyen Van A",
  "phone": "0901234567",
  "addressLine": "123 Duong So 1",
  "country": "VN",
  "provinceCode": "79",
  "provinceName": "Ho Chi Minh",
  "districtCode": "760",
  "districtName": "Quan 1",
  "wardCode": "26734",
  "wardName": "Ben Nghe",
  "isDefault": true
}
```

## 7) Hướng dẫn cho frontend

- Luôn xử lý `401` để chuyển qua flow refresh token.
- Nếu refresh fail, logout local và điều hướng về login.
- Với list endpoint, backend giới hạn `limit` tối đa 50.
- Với auth endpoint, cần xử lý `429` và thông báo người dùng chờ đợi.

## 8) Tài liệu liên quan

- Postman collection: `postman-collections/1704_bookstore-api.postman_collection.json`
- README index: `README.md`
- Route source:
  - `src/routes/auth.routes.ts`
  - `src/routes/book.routes.ts`
  - `src/routes/category.routes.ts`
  - `src/routes/cart.routes.ts`
  - `src/routes/order.routes.ts`
  - `src/routes/user.routes.ts`
  - `src/routes/admin.routes.ts`
  - `src/routes/address.routes.ts`

## 9) Lưu ý cập nhật

Mỗi thay đổi endpoint/DTO phải cập nhật file này và Postman collection cùng lúc.
