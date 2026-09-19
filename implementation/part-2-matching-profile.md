# Part 2 — Matching Engine (#1) + Profile Editing (#8)

**Stories:** #1 "Перший крок до сили" (P0, 8 SP) + #8 "Моє спортивне обличчя" (P1, 5 SP) = **13 SP**
**Depends on:** Part 1 (users exist, onboarding feeds profile fields)

## Why together
Matching quality is profile quality. Building #8 in the same part means matching filters have real, up-to-date data to work with.

---

## 2A. Matching Engine (#1)

### Backend
- [x] Data model:

```
match_requests(id, from_user_id, to_user_id, status[pending|accepted|declined|expired], created_at)
matches(id, user_a_id, user_b_id, status[active|finished|cancelled], scheduled_at, created_at)
```

- [x] `GET /matching/search?level=&goal=&schedule=&gym_id=` — exact-tag matching (no ML per plan.md); returns cards: name, photo, level, goal; target p95 < 3s (story test), must exclude blocked users and already-requested/declined pairs
- [x] `POST /matching/requests` {to_user_id} → creates request, push to recipient
- [x] `POST /matching/requests/:id/accept|decline` → on accept: creates `matches` row (this unblocks Part 3 chat)
- [x] Empty-result UX contract: `200` + `[]` (frontend shows "Розширити пошук" hint)

### Mobile
- [x] Filter screen: level, goal, time slot, gym (pre-filled from own profile)
- [x] Result card list + "Запросити" → card state "Запит надіслано"
- [x] Empty state with "Розширити пошук" (drops filters progressively)
- [x] Incoming requests inbox (accept/decline)

### Exit criteria (plan.md §5, story #1)
- [x] Seeded users: filters (початківець / набір маси / вечір / SportLife) return ≥2 profiles in <3s
- [x] No-results state renders the exact message from Gherkin + widen-search button
- [x] Request → recipient push fires

---

## 2B. Profile Editing (#8)

### Backend
- [x] `PATCH /users/me` — photo, bio, goal, level, schedule, favorite exercises, gym
- [x] Validation: bio non-empty (per Gherkin), photo size/type limits
- [x] Profile versioning or cache invalidation so search results reflect changes immediately (story risk #8: "профіль не оновлюється миттєво")

### Mobile
- [x] "Мій профіль" view + edit form (photo picker, tag selectors, schedule grid)
- [x] "Подивитись як виглядає для інших" — read-only preview mode
- [x] Optimistic save with error rollback (e.g. empty bio error from AC)

### Exit criteria (plan.md §5, story #8)
- [x] Edited photo/goal/bio visible in another user's search results without app reload
- [x] Empty bio → validation error, nothing saved
- [x] Preview mode matches what other users see
