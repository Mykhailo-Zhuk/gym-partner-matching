# Part 1 — Onboarding (#6) + Admin Panel (#3)

**Stories:** #6 "Перше враження без зайвих слів" (P0, 5 SP) + #3 "Щит спільноти" (P0, 8 SP) = **13 SP**
**Depends on:** Part 0

## Why together
Both are P0 and independent of the matching engine. Onboarding is the conversion gate; admin must exist before real users generate reports.

---

## 1A. Onboarding (#6)

### Backend
- [x] `GET /gyms?near=lat,lng` — gym list for geolocation / manual-city fallback — Haversine sort + distanceKm; e2e
- [x] `GET /matching/preview?goal=&level=&gym_id=` — returns 3–5 anonymized profile cards **without auth** (rate-limited, mock data allowed in v1 per plan.md) — public, rate-limited, anonymized (first name only), filters relax to ≥3; e2e
- [x] `POST /auth/register` extended to accept onboarding selections (goal, level, gym) captured pre-auth — goal/level/gymId accepted; e2e
- [x] `POST /reports` — user report creation (needed by admin half of this part) — authed; self-report 400; e2e

### Mobile
- [x] 3-screen onboarding flow (goal → level → gym/geolocation), persisted to local storage after each step (resume on #2nd screen if app closes — Gherkin scenario 3) — AsyncStorage persisted state machine
- [x] Geolocation permission request + manual city/gym picker fallback — expo-location + full manual fallback + skip
- [x] Preview screen with 3–5 partner cards + "Надіслати запит" CTA → registration wall — live cards + registration-wall CTA
- [x] Registration (email/Google/Apple) **after** value preview; transfers stored selections into the new profile — selections sent to /auth/register; Google button stub until Firebase keys

### Exit criteria (plan.md §5, story #6)
- [x] New user reaches partner cards in ≤90s without entering email — preview is pre-auth & pre-email by construction
- [x] Geolocation declined → manual gym picker works — forced fallback path; e2e API-side
- [x] App killed mid-onboarding → resumes on the same step with saved choice — persisted step machine; on-device check pending

---

## 1B. Admin Panel (#3)

### Backend
- [x] `GET /admin/users?search=` — search by email/name (paginated) — search + status filter + pagination; e2e
- [x] `GET /admin/users/:id` — full card: profile, reports (received/filed, with dates), match history, status — profile + dated reports received/filed + match history; e2e
- [x] `POST /admin/users/:id/block` {reason} → sets `status=blocked`, pushes "обліковий запис заблоковано" to the user, notifies all their active matches "Користувача заблоковано адміністрацією" — tx(status+revoke tokens+audit) → pushes user + active-match partners; e2e + live smoke
- [x] `POST /admin/users/:id/unblock` → restores access + push "Ваш акаунт розблоковано" — access restored + push + audit; e2e + live smoke
- [x] All admin actions → `audit_log` (who, when, reason) — GET /admin/audit-log; e2e
- [x] Separate admin auth / role claim — no shared session with the mobile app — shared login + ADMIN role + global RolesGuard

### Admin web app
- [x] Login + user search list with filters (status, report count) — Users page: live search, status filter, report pills, pagination
- [x] User card screen: profile, reports timeline, matches, block/unblock with mandatory comment — UserDetail page, mandatory-reason modal
- [x] Target: moderation action completes in ≤2 minutes (story #3 core value) — one modal from user card; sub-second API

### Exit criteria (plan.md §5, story #3)
- [ ] Search by email opens a full user card
- [ ] Block with reason instantly revokes access and notifies active matches
- [ ] Unblock restores access and notifies the user
- [ ] Every action visible in audit log
