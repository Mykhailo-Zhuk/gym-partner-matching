# GymBrosUK — Implementation Plan (split by parts)

Source: [plan.md](../plan.md) — 11 user stories, 68 SP, ~68 dev-days.

The implementation is split into **Part 0 (foundation)** + **5 delivery parts**, matching the sprint plan in plan.md. Each part is a shippable increment with its own backend, frontend, QA scope and exit criteria.

## Part map

| Part | Stories | Name | SP | Depends on |
|------|---------|------|----|------------|
| [Part 0](part-0-foundation.md) | — | Project foundation | ~8 | — |
| [Part 1](part-1-onboarding-admin.md) | #6, #3 | Onboarding + Admin panel | 13 | Part 0 |
| [Part 2](part-2-matching-profile.md) | #1, #8 | Matching engine + Profile editing | 13 | Part 1 |
| [Part 3](part-3-chat-push.md) | #7, #4 | Chat + Push reminders | 13 | Part 2 |
| [Part 4](part-4-dashboard-ratings.md) | #2, #5 | Shared dashboard + Ratings | 13 | Part 2 (Part 3 for notifications) |
| [Part 5](part-5-growth.md) | #9, #10, #11 | Referrals + Badges + Groups | 16 | Parts 1–4 |

## Why this order

- **Part 0 first**: nothing here is in plan.md, but a greenfield project needs infra, data model, auth and push plumbing before any story can land.
- **Part 1 (not matching first)**: per plan.md, onboarding (#6) is the P0 conversion gate, and admin (#3) must exist before real users arrive. Admin ships early so moder tooling is never a bottleneck.
- **Part 2**: matching (#1) is the core value; profile editing (#8) feeds quality data into matching.
- **Part 3**: chat (#7) and push reminders (#4) both need active matches to exist.
- **Part 4**: dashboard (#2) and ratings (#5) need completed workouts/matches.
- **Part 5 last**: P2 growth features (referrals #9, badges #10, groups #11) are purely additive and can slip without blocking launch.

## Launch gate

MVP can launch after **Part 4**. Part 5 is post-launch growth scope (can be re-prioritized).

## Status (2026-08-26)

| Part | Backend status |
|------|----------------|
| **Part 0** Foundation | ✅ **Done** — monorepo, Compose (PG 5433 / Redis 6380 / MinIO 9100), Prisma schema+migrations, email+social auth with refresh rotation, notification facade (FCM / log), blocked-user guard (403 `ACCOUNT_BLOCKED` + immediate token revocation), audit log, presigned uploads, seed. Unit 45/45, e2e 38/38, CI in `.github/workflows/ci.yml`. |
| **Part 1** Onboarding+Admin | ✅ API done — `GET /gyms` (+near/city), anonymized rate-limited `/matching/preview`, onboarding selections on register/social; `/admin/users` search, user card with reports+match history, block/unblock with pushes + audit, `/admin/audit-log`. Admin PWA frontend not built. |
| **Part 3** Chat+Reminders | ✅ API done — chat history (`/matches/:id/messages`, cursor pagination), Socket.IO fanout, offline-recipient push, photo messages, system messages, BullMQ T-60/T-15 reminders (idempotent, no orphans), schedule/end/en-route. |
| **Part 4** Dashboard+Ratings | ✅ API done — workouts (`POST /matches/:id/workouts`), shared dashboard with server-side aggregates (count / total kg / weekly streak), joint goals with partner confirmation + "Ціль виконано! 🎉" push to both, `POST /matches/:id/complete` with optional 3×5-star rating (skip path supported), `GET /users/:id/rating-summary` (average, count, last 3 comments), rating aggregates embedded in `/matching/preview` cards. |
| **Part 5** Growth | ✅ API done — Referrals (#9): personal 8-char code + share link, +3 days subscription bonus to both sides on registration, exact "Код не знайдено" 400 for bad codes, `GET /admin/referrals/stats`. Badges (#10): event-driven engine, 6 MVP rules (Перший крок, Перевірена пара, Перший підхід, Тоннаж, Амбасадор, Стабільність), `/users/me/badges` (earned + locked with rules), award push, idempotent via UNIQUE on user_badges. Groups (#11): create with 1..4 invitees (max 5), per-invitee push, accept/decline, N-participant group chat (`group_messages` table, Socket.IO fanout), T-24h creator reminder via existing BullMQ queue, group cap enforced. Mobile app scaffold (RN/Expo) not started — `/docs` (OpenAPI) is ready as its contract. Unit 49/49, e2e 64/64. |
| **Part 2** Matching+Profile | ✅ **Done** — `GET /matching/search` (exact-tag, excludes blocked/requested/matched), `POST /matching/requests`, `POST /requests/:id/accept|decline`, incoming requests inbox, push on request/accept; `PATCH /users/me` (photo, bio, level, goal, schedule, gym), empty-bio validation. Rating summary embedded in search results. |

Mobile app scaffold (RN/Expo) not started — `/docs` (OpenAPI) is ready as its contract.

## Cross-cutting rules for all parts

1. Every endpoint ships with an OpenAPI spec before frontend starts (DoR #4 in plan.md).
2. Push notifications go through a single `NotificationService` built in Part 0 — never call Firebase directly from feature code.
3. All blocking/moderation checks go through a single `UserGuard` from Part 1 — a blocked user must fail fast in every endpoint.
4. Each part's exit criteria = the Gherkin scenarios for its stories in plan.md §5.
5. Seeded test data from Part 0 (fake users/gyms/matches) is reused for QA of every part.
