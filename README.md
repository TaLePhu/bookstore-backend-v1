# BookStore Backend API

Production-ready Node.js + Express + TypeScript backend with Clean Architecture, TypeORM, PostgreSQL with pgvector support, and full JWT authentication.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js 4
- **Language**: TypeScript 5
- **ORM**: TypeORM 0.3
- **Database**: PostgreSQL 14+ with pgvector
- **Authentication**: JWT (access + refresh tokens)
- **Validation**: class-validator + class-transformer
- **Dependency Injection**: tsyringe
- **Security**: Helmet, CORS, Rate Limiting, bcryptjs

## Project Structure

```
src/
├── app.ts                    # Express app configuration
├── server.ts                 # Server bootstrap
├── config/
│   ├── env.ts               # Environment configuration
│   ├── data-source.ts       # TypeORM datasource
│   └── container.ts         # DI container setup
├── entities/                # Domain entities
│   ├── User.ts
│   ├── Book.ts
│   ├── Order.ts
│   └── ...other entities
├── repositories/
│   ├── interfaces/          # Repository contracts
│   └── typeorm/             # TypeORM implementations
├── services/
│   ├── AuthService.ts
│   ├── UserService.ts
│   └── EmbeddingSearchService.ts
├── controllers/
│   ├── AuthController.ts
│   └── UserController.ts
├── dtos/
│   ├── auth/
│   │   ├── RegisterDto.ts
│   │   ├── LoginDto.ts
│   │   └── RefreshTokenDto.ts
│   └── user/
│       └── UpdateProfileDto.ts
├── middlewares/
│   ├── auth.middleware.ts
│   ├── validate.middleware.ts
│   ├── role.middleware.ts
│   └── error.middleware.ts
├── routes/
│   ├── auth.routes.ts
│   ├── user.routes.ts
│   └── index.ts
├── utils/
│   ├── response.ts
│   ├── errors.ts
│   ├── jwt.ts
│   ├── hash.ts
│   └── async-wrapper.ts
├── migrations/              # TypeORM migrations
└── seeds/                   # Database seeders (optional)
```

## Setup and Installation

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm or yarn

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Update the following critical variables:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=bookstore

# JWT Secrets (change these in production!)
JWT_ACCESS_SECRET=your-super-secret-access-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Server
PORT=3000
NODE_ENV=development
```

### 3. Database Setup

Create PostgreSQL database:

```bash
createdb bookstore
```

Grant pgvector extension permission (if using separate user):

```sql
-- Connect to PostgreSQL
psql -U postgres -d bookstore

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. Run Migrations

```bash
npm run migration:run
```

This will:
- Create all database tables
- Set up foreign key relationships
- Enable pgvector extension
- Create necessary indexes

### 5. Build and Start

Development mode (with ts-node):

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

## API Documentation

Base URL: `http://localhost:3000/api/v1`

### Authentication Endpoints

#### Register
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "550e8400-e29b-41d4-a71...",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "CUSTOMER"
    }
  },
  "message": "User registered successfully"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

#### Refresh Token
```http
POST /auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <accessToken>
```

### User Endpoints

#### Get Profile
```http
GET /users/me
Authorization: Bearer <accessToken>
```

#### Update Profile
```http
PATCH /users/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "John Updated"
}
```

### Health Check
```http
GET /health
```

## Validation Rules

### Register
- **name**: 2-255 characters
- **email**: Valid email format, unique
- **password**: 
  - 8-255 characters
  - Must contain uppercase, lowercase, and number

### Login
- **email**: Valid email format
- **password**: Non-empty

### Update Profile
- **name**: Optional, 2-255 characters if provided

## Response Format

All successful responses follow this format:

```json
{
  "success": true,
  "data": { /* any data */ },
  "message": "Human-readable message"
}
```

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "data": { /* optional validation errors */ }
}
```

## Security Features

✅ **Password Hashing**: bcryptjs with 10 salt rounds  
✅ **JWT Tokens**: Short-lived access tokens (15m), longer refresh tokens (7d)  
✅ **Token Persistence**: Refresh tokens stored in database with revocation support  
✅ **Token Rotation**: Old refresh tokens revoked on each refresh  
✅ **CORS**: Configurable by environment  
✅ **Helmet**: Security headers  
✅ **Rate Limiting**: 100 requests per 15 seconds  
✅ **SQL Injection Protection**: TypeORM parameterized queries  
✅ **Input Validation**: DTOs with class-validator  

## Database Schema Highlights

### Role Enum
- `GUEST`
- `CUSTOMER`
- `STAFF`
- `ADMIN`

### Order Status Enum
- `PENDING`
- `PROCESSING`
- `SHIPPED`
- `COMPLETED`
- `CANCELLED`

### Key Tables
- **users**: User aggregates with role-based access
- **refresh_tokens**: DB-backed refresh token persistence with revocation
- **embeddings**: pgvector support for book similarity search
- **user_behaviors**: Tracking user interactions (VIEW, CLICK, ADD_TO_CART, PURCHASE, WISHLIST)
- **orders**: Complete order lifecycle
- **reviews**: Book reviews with ratings

## Advanced Features

### Vector Search (Bonus)
The `EmbeddingSearchService` supports semantic similarity search:

```typescript
const service = container.resolve(EmbeddingSearchService);

// Store embedding
await service.storeEmbedding(bookId, vector1536);

// Search similar books
const results = await service.searchSimilar(queryVector, 10, 0.5);
// Returns: [{ bookId, similarity }]
```

### Role-Based Access
Use the `roleGuard` middleware for protected actions:

```typescript
router.delete('/orders/:id/cancel', 
  authMiddleware,
  roleGuard(Role.STAFF, Role.ADMIN),
  controller.cancelOrder
);
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled server |
| `npm run typecheck` | Type check only |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix linting issues |
| `npm run migration:run` | Run pending migrations |
| `npm run migration:generate` | Generate migration from entity changes |
| `npm run migration:revert` | Revert last migration |

## Error Handling

The application implements centralized error handling with custom error classes:

- `AppError`: Base error (500)
- `ValidationError`: DTO validation (400)
- `NotFoundError`: Resource not found (404)
- `UnauthorizedError`: Auth failure (401)
- `ForbiddenError`: Permission denied (403)
- `ConflictError`: Duplicate resource (409)

All errors are caught by the global error middleware and returned in standardized format.

## Testing

Example with curl:

```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "TestPass123"
  }'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'

# Get profile (replace TOKEN with actual token)
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer TOKEN"
```

## Performance Notes

- **Database Indexes**: Automatic on foreign keys + custom on `user_id`, `created_at`, email
- **Vector Index**: IVFFLAT for pgvector with cosine similarity
- **Connection Pooling**: TypeORM handles pooling automatically
- **Rate Limiting**: 100 requests per 15s window

## Production Deployment Checklist

- [ ] Set strong JWT secrets in `.env`
- [ ] Enable HTTPS (use reverse proxy like nginx)
- [ ] Set `NODE_ENV=production`
- [ ] Set `DB_LOGGING=false`
- [ ] Configure database backups
- [ ] Set up monitoring and error tracking
- [ ] Implement API versioning strategy
- [ ] Set up CI/CD pipeline
- [ ] Configure CORS for frontend domain
- [ ] Enable database connection pooling limits
- [ ] Set up refresh token cleanup job
- [ ] Configure logging/observability

## Future Enhancements

- [ ] OpenAPI/Swagger documentation
- [ ] Rate limiting per user
- [ ] Two-factor authentication
- [ ] Email verification
- [ ] Password reset flow
- [ ] User sessions management
- [ ] Audit logging
- [ ] GraphQL support
- [ ] Multi-tenant support
- [ ] Event-driven architecture with message queue

## Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1"

# Verify DB_* env variables are set correctly
cat .env | grep DB_
```

### pgvector Extension Not Found
```sql
-- Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify it's installed
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### JWT Token Errors
- Ensure `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are set
- Check token format: `Bearer <token>`
- Verify token hasn't expired

### Port Already in Use
```bash
# Change PORT in .env or kill process on port 3000
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

## License

MIT

## Support

For issues and contributions, standard GitHub workflow applies.

---

**Last Updated**: March 22, 2026  
**Version**: 1.0.0
