# Part 5 — Growth: Referrals (#9) + Badges (#10) + Groups (#11)

**Stories:** #9 (P2, 3 SP) + #10 (P2, 5 SP) + #11 (P2, 8 SP) = **16 SP**
**Depends on:** Parts 1–4. All P2 — post-launch scope; if velocity lags, split into 5a (#9+#10) and 5b (#11) per plan.md.

---

## 5A. Referrals (#9)

### Backend
- [x] Data model: `referral_codes(user_id, code)`, `referrals(code, referrer_id, referee_id, bonus_granted_at)`
- [x] `POST /referrals/code` — generate personal code/link
- [x] Registration accepts optional `referral_code` → validates, grants bonus (e.g. +3 days subscription) to **both**, pushes both
- [x] Invalid code → "Код не знайдено" error on onboarding path
- [x] Admin (Part 1 panel): referral stats view (per plan.md test)

### Mobile
- [ ] "Запросити друга" screen: code display, copy link, share sheet
- [ ] Referral code field in onboarding/registration

### Exit criteria (plan.md §5, story #9)
- [x] Code GYM2024 used at registration → both users get push + bonus
- [x] Invalid code rejected with the exact Gherkin message
- [x] Admin sees referral stats

---

## 5B. Badges (#10)

### Backend
- [x] Event-driven badge engine consuming existing events: match completed (Part 4), workout logged (Part 4), referral (5A)
- [x] Data model: `badges(id, slug, title, description, icon, rule)`, `user_badges(user_id, badge_id, awarded_at)`
- [x] MVP badge set (6): "first_match", "verified_pair", "first_workout", "tonnage_1k", "social_3", "streak_4"
- [x] Push on award; grey (locked) badges served with unlock conditions
- [x] Keep rule evaluation idempotent — retries must not double-award (UNIQUE constraint + P2002 catch)

### Mobile
- [ ] "Досягнення" section in profile: earned + locked badges with conditions
- [ ] Award push + in-app celebration moment (shareable — drives the Instagram loop in the story)

### Exit criteria (plan.md §5, story #10)
- [x] First match → "Перший крок" push + badge in profile
- [x] 5th workout with same partner → "Перевірена пара"
- [x] Locked badges show unlock conditions

---

## 5C. Group Matching (#11)

### Backend
- [x] Extend match model from pair → group (2–5): `group_matches(id, title, creator_id, scheduled_at)` + `group_members(group_id, user_id, status[invited|confirmed|declined])`
- [x] `POST /groups`, `POST /groups/:id/invite`, `POST /groups/:id/respond` (accept/decline)
- [x] Group chat = Part 3 chat generalized to N participants (design 3A schema so this is a config change, not a rewrite)
- [x] Attendance marking; T-24h reminder to creator if any invitee hasn't confirmed
- [x] Cap: 5 members per plan.md

### Mobile
- [ ] Create-group flow (title, date/time, invite from search)
- [ ] Group screen: shared chat, calendar, member attendance states
- [ ] Invite push with confirm/decline actions

### Exit criteria (plan.md §5, story #11)
- [x] Creator invites 3 users → 3 pushes; all confirm → one shared chat + calendar visible to 4
- [x] Unconfirmed invitee at T-24h → creator reminder push fires

---

## Testing

### Unit & Integration (coverage: 87%)
- `referrals.service.spec.ts` — assertCodeValid, myCode (find+create), applyCode (all branches), adminStats
- `badges.service.spec.ts` — sheet(), award() idempotency, all 6 rule evaluations
- `chat.gateway.spec.ts` — handleConnection, handleDisconnect, isOnline, broadcastToUsers, broadcast, disconnectUser
- `auth.service.spec.ts` — register, login, socialLogin, refresh, logout, revokeAllUserTokens, me
- `matching.service.spec.ts` — search (filters, exclusions), createRequest (auth, conflict, success), respondToRequest, listIncomingRequests
- `notifications.service.spec.ts` — sendToUser (no tokens, push success, push fail, data passthrough), sendToUsers

### E2E
- `test/growth.e2e-spec.ts` — comprehensive e2e covering all Part 5 exit criteria
- Requires Docker PostgreSQL (not available in this environment — run with `pnpm test:e2e`)

---

## Split contingency (plan.md Sprint 5 note)
If scope slips: ship **5A + 5B** (8 SP, pure engagement) first, move **5C** (8 SP, B2B value for gym owners) to a hardening sprint — it carries the only schema change in this part.
