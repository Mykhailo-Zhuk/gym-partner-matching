# GymBrosUK 💪

MVP застосунку для пошуку партнера в спортзал: онбординг за 4 кроки, превʼю партнерів ще до реєстрації, мэтчинг, чат і панель адміністратора з модерацією.

## Prerequisites

- **Node.js** ≥20
- **Docker** & Docker Compose
- **pnpm** 9.x (`npm i -g pnpm`)

## Quickstart

```bash
# 1. Start infrastructure
pnpm docker:up

# 2. Install dependencies
pnpm install

# 3. Create database schema
pnpm --filter api prisma:migrate

# 4. Seed demo data (2 gyms, ~20 users, admin, demo pairs & reports)
pnpm seed

# 5. Start API
pnpm --filter api start:dev
```

> API → http://localhost:3000 | Swagger docs → http://localhost:3000/docs

## Apps

| App | Start | URL | Demo credentials |
|-----|-------|-----|------------------|
| **Admin Panel** | `pnpm --filter admin dev` | http://localhost:5173 | `admin@gymbros.dev` / `admin1234` |
| **Mobile App** | `pnpm --filter mobile start` | Expo | — |
| **API** | `pnpm --filter api start:dev` | http://localhost:3000 | — |

> Mobile app on Android emulator: set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`

## Demo Data

Seeded users: any `@gymbros.dev` email, password `password123`.

Special accounts:
- `admin@gymbros.dev` — admin panel access
- `toxic@gymbros.dev` — flagged for moderation demo

## Monorepo Structure

```
apps/
├── api/       NestJS + Prisma + Redis
├── admin/     React + Vite admin panel
└── mobile/    Expo React Native app
```

## Commands

```bash
pnpm dev              # Start API (infrastructure must be up)
pnpm docker:up        # Start Postgres :5433, Redis :6380, MinIO :9100/:9101
pnpm docker:down      # Stop all containers
pnpm seed             # Re-seed demo data
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all packages
pnpm test             # Run all tests
pnpm --filter api test:e2e  # E2E tests (requires docker compose up)
```

## Environments

| Environment | How | Notes |
|---|---|---|
| **Local** | `pnpm docker:up` → dev servers | Postgres :5433, Redis :6380, MinIO :9100/:9101; demo data via `pnpm seed` |
| **Staging** | `pnpm docker:staging` | Full stack from `docker-compose.prod.yml` on a single host |
| **Production** | `pnpm docker:prod` | Same compose file, stricter env file; TLS in front is mandatory |

### Deploy staging / production

1. Prepare the env file on the server:
   ```bash
   cp .env.staging.example .env.staging      # or .env.production.example
   # fill in: POSTGRES_PASSWORD, JWT_ACCESS_SECRET, S3 keys,
   # S3_ENDPOINT = http://<server-ip>:9100 (public — presigned URLs embed it)
   ```
2. Start the stack:
   ```bash
   pnpm docker:staging        # or: pnpm docker:prod
   ```
   The api container runs `prisma migrate deploy` on boot, creates the MinIO
   uploads bucket via the one-shot `minio-init` service, and serves on :3000;
   the admin panel (nginx, same-origin API proxy) on :8080.
3. Point clients at it:
   - Mobile: `EXPO_PUBLIC_API_URL=http://<server>:3000`
   - Admin: `http://<server>:8080`
4. Seed staging demo data (optional): `docker compose --env-file .env.staging -f docker-compose.prod.yml exec api node_modules/.bin/tsx prisma/seed.ts`

CI builds both images on every PR (`docker` job in ci.yml), so a broken
Dockerfile fails the build before it reaches a server. Secrets checklist for
production is at the top of `.env.production.example`; generate values with
`openssl rand`. Postgres/Redis are not exposed to the host — only api, admin
and MinIO ports are.

## Key Guarantees (Part 0/1)

- **UserGuard**: blocked users instantly get `403 { code: "ACCOUNT_BLOCKED" }` on any endpoint (checks status in DB on each request)
- **Audit log**: blocking/unblocking records actor, action, reason, and timestamp — visible at `GET /admin/audit-log`
- **Push notifications**: via `NotificationsService` facade → `FcmPushProvider` (with Firebase keys) or `LogPushProvider` (local, prints to console)
- **Admin auth**: same `POST /auth/login` endpoint; admin routes protected by global `RolesGuard` requiring `role: "ADMIN"`

## Troubleshooting

**Port already in use**: Check `.env` for custom ports or stop conflicting services.

**Database connection failed**: Ensure Docker is running and `pnpm docker:up` completed successfully.

**Migration errors**: Reset with `pnpm --filter api prisma migrate reset` (WARNING: deletes all data).

## Environment Variables

Copy `.env.example` to `.env` in `apps/api/`:

```bash
cp .env.example apps/api/.env
```

Key variables:
- `DATABASE_URL` — PostgreSQL connection (default: `postgresql://gymbros:gymbros@localhost:5433/gymbros`)
- `REDIS_URL` — Redis connection (default: `redis://localhost:6380`)
- `JWT_*_SECRET` — Change these in production!
- `FCM_SERVICE_ACCOUNT_JSON` — Leave empty to use log/no-op push provider
