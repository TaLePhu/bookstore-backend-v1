# BookStore Backend API

Backend for the BookStore system built with Node.js, Express, TypeScript, and TypeORM.

## Current Status

- Implemented API modules: Auth, Users, Books, Categories, Cart, Orders, Admin.
- Migration workflow is active via TypeORM.
- Seed scripts are available:
  - `npm run db:seed` (insert sample data)
  - `npm run db:reset-seed` (reset business tables then reseed)
- Controller DI pattern is unified for core modules.

## API Documentation (Primary Source)

README keeps only high-level information.
Detailed endpoint contracts are maintained at:

- [documents/API_REFERENCE_VN_EN.md](documents/API_REFERENCE_VN.md)

Postman collection for executable requests:

- [postman-collections/1404_BookStoreAPI.postman_collection.json](postman-collections/1404_BookStoreAPI.postman_collection.json)

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Create environment file

```bash
cp .env.example .env
```

3. Run migrations

```bash
npm run migration:run
```

4. Seed sample data (optional)

```bash
npm run db:seed
```

5. Start backend

```bash
npm run dev
```

## API Base URL

- `http://localhost:3000/api/v1`
- Health check: `GET http://localhost:3000/health`

## Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm run typecheck` | Type check only |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run migration:run` | Run pending migrations |
| `npm run migration:revert` | Revert last migration |
| `npm run db:seed` | Seed sample data |
| `npm run db:reset-seed` | Reset business tables then seed |

## Environment Variables

See:

- [.env.example](.env.example)

Security note: do not commit real secrets (DB password, JWT secrets, SMTP credentials).
