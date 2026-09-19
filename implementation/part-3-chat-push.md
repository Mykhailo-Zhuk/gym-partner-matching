# Part 3 — Chat (#7) + Push Reminders (#4)

**Stories:** #7 "Домовитись до залу" (P0, 8 SP) + #4 "Дружній поштовх" (P1, 5 SP) = **13 SP**
**Depends on:** Part 2 (active `matches` exist), Part 0 (`NotificationService`, file upload)

## Why together
Both are realtime/communication concerns keyed off the same `matches.scheduled_at` field. Reminder copy deep-links into the match chat.

---

## 3A. Chat (#7)

### Backend
- [x] Data model: `messages(id, match_id, sender_id, type[text|image|system], body, media_url, created_at)` — already in schema
- [x] Transport: WebSocket (Socket.io per DoR #9); delivery ≤2s via in-process fanout; history persisted
- [x] `GET /matches/:id/messages?before=` — paginated history (cursor-based)
- [x] Access rule: chat only for `matches.status=active` participants; blocked users lose chat immediately (Part 1 guard)
- [x] Push on new message to offline recipient (via NotificationService)
- [x] Image messages via Part 0 upload pipeline (`POST /uploads/presign`)

### Mobile
- [x] Chat screen in the active match card (bubbles, timestamps)
- [x] Chat list / entry only when an active match exists; otherwise empty state
- [x] System messages rendered distinctly ("Дмитро в дорозі 🚗" from #4 hooks)
- [x] Realtime message delivery via Socket.io client (`message:new` event)
- [x] Online/offline status indicator

### Exit criteria (plan.md §5, story #7)
- [x] Two devices: message visible on both in ≤2s, recipient push fires when app backgrounded
- [x] Photo message delivers and renders
- [x] No active match → "Чат доступний тільки для активних матчів"

---

## 3B. Push Reminders (#4)

### Backend
- [x] Scheduler (BullMQ delayed jobs) on `matches.scheduled_at`:
  - T-60min: "Не забудь! Через годину тренування з {partner}"
  - T-15min: "Тренування за 15 хвилин! Готовий?" with action "Я в дорозі"
- [x] `POST /matches/:id/en-route` → partner push "{name} вже в дорозі!" + system message into chat (3A)
- [x] Reschedule/cancel → pending reminders invalidated
- [x] Idempotency: one reminder per slot per user even if rescheduled repeatedly

### Mobile
- [x] Match scheduling UI (date/time picker) — triggers reminder pipeline
- [x] "Я в дорозі" action from T-15 notification deep-link (handled via deeplink → chat)

### Exit criteria (plan.md §5, story #4)
- [x] Match at 19:00 → pushes at exactly 18:00 and 18:45
- [x] "Я в дорозі" → partner push + chat system message
- [x] Missed/cancelled match → no orphan reminders
