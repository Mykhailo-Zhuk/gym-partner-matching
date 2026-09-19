# Part 0 — Project Foundation — ✅ done 2026-08-25, completed 2026-08-29

**Not a user story** — enablement work required before Stories #6/#3 can start. ~8 SP.

## Scope

### Infrastructure
- [x] Monorepo scaffold: `apps/api`, `apps/mobile`, `apps/admin` (suggested: NestJS or Fastify + React Native/Flutter + React admin) — NestJS + Expo RN + React/Vite
- [x] CI pipeline: lint, typecheck, unit tests, build per app — `.github/workflows/ci.yml`
- [x] Environments: local (docker-compose), staging, production — local `docker-compose.yml`; staging/prod `docker-compose.prod.yml` + `apps/{api,admin}/Dockerfile` + `.env.{staging,production}.example`; full stack boot-verified locally 2026-08-29
- [x] Postgres + migrations tool; Redis for push/scheduling queue — Prisma 6 + docker-compose (5433/6380/9100)

### Core backend
- [x] Base data model (all parts depend on this): — prisma/schema.prisma

```
users(id, email, password_hash, name, role[user|admin], status[active|blocked],
      level, goal, schedule, gym_id, photo_url, bio, created_at)
gyms(id, name, city, geo)
refresh_tokens / sessions
device_tokens(user_id, platform, token)          -- for push
notifications(id, user_id, type, payload, sent_at)
audit_log(id, actor_id, action, target_type, target_id, meta, created_at)
```

- [x] Auth: email/password + Sign in with Google/Apple, JWT access + refresh — JWT + rotated opaque refresh tokens; social via firebase-admin (dev-token path until keys)
- [x] `NotificationService` facade (Firebase FCM behind one interface) — used by #1, #3, #4, #7, #9, #10 — FcmPushProvider | LogPushProvider
- [x] `UserGuard`: rejects requests from `status=blocked` users everywhere — UserStatusGuard, DB status check per request
- [x] Audit logging middleware → `audit_log` (admin needs it in Part 1) — AuditService
- [x] File upload to object storage (photos for #7/#8) — POST /uploads/presign → MinIO presigned PUT

### Post-completion fixes (2026-08-29 audit)
- [x] `GET/PATCH /users/me` leaked `passwordHash` (raw Prisma row) — fixed via shared `toSafeUser` (`src/common/safe-user.ts`); regression-tested in `test/users.e2e-spec.ts`
- [x] Dead code removed: `UsersService.setBlocked` (admin has its own audited `blockUser`)

### Test data
- [x] Seeder: 2 gyms (incl. "SportLife Поділ"), ~20 fake users with varied level/goal/schedule/tags — required by #6 onboarding preview and #1 matching tests — prisma/seed.ts, idempotent, demo matches+reports

## Exit criteria (all verified live 2026-08-25; staging stack re-verified 2026-08-29)
- [x] `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` work on staging — verified via smoke + e2e (register→login→me→rotation, no passwordHash leak) + re-smoked on the dockerized staging stack (register→login→me→refresh)
- [x] A test push can be sent to a registered device via `NotificationService` — log provider without FCM creds; covered by admin-block & chat e2e
- [x] CI green; docker-compose up gives a working local stack — `.github/workflows/ci.yml`: lint, typecheck, unit, e2e, build, docker image build
- [x] Blocking a user in DB immediately revokes their API access (guard proven by test) — `UserStatusGuard` unit-tested + e2e (`admin.e2e`), smoke-verified: existing token gets 403 `ACCOUNT_BLOCKED` (UA message) — re-verified on the dockerized staging stack 2026-08-29
