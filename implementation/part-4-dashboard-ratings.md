# Part 4 — Shared Dashboard (#2) + Ratings (#5)

**Stories:** #2 "Дашборд спільного прогресу" (P1, 8 SP) + #5 "Відповідальність у відгуку" (P1, 5 SP) = **13 SP**
**Depends on:** Part 2 (matches). Pushes reuse Part 3 plumbing if present, but not a hard blocker.

## Why together
Both trigger on match completion: finishing a workout feeds the dashboard and prompts the rating flow. One "complete workout" event drives both.

---

## 4A. Shared Dashboard (#2)

### Backend
- [x] Data model: `workouts`, `pair_goals` — already in schema
- [x] `POST /matches/:id/workouts` — manual workout entry; visible to both partners
- [x] `GET /matches/:id/dashboard` — calendar entries + aggregates (workout count, total kg, streak)
- [x] `POST /matches/:id/goals` → partner must confirm (push); `active` only after confirmation
- [x] Goal progress recalculated on every workout write; on target hit → push both: "Ціль виконано! 🎉"
- [x] Consistency rule: both partners read identical aggregates — computed server-side

### Mobile
- [x] Dashboard screen: stats cards, goal progress bars, workout history
- [x] "+ Додати тренування" form (date, type, sets/reps/weight)
- [x] Goal creation flow (WORKOUT_COUNT / TOTAL_KG metric, optional deadline)
- [x] Incoming goal confirmation prompt (pending goals shown at top of dashboard)

### Exit criteria (plan.md §5, story #2)
- [x] Maria logs 5×80 kg → Dmytro's totals update on next fetch
- [x] Goal "10 тренувань за червень" requires partner confirmation, shows live progress bar, completes with a push to both

---

## 4B. Ratings (#5)

### Backend
- [x] Data model: `ratings` — already in schema
- [x] `POST /matches/:id/complete` {rating?} — finish match; ratings optional ("Пропустити" path)
- [x] `GET /users/:id/rating-summary` — average (e.g. 4.7⭐), rating count, last 3 comments
- [x] Rating summary embedded in matching search cards
- [x] Uniqueness: one rating per rater per match

### Mobile
- [x] "Завершити тренування" → 3×5-star form (punctuality, communication, spotting) + comment, with "Пропустити"
- [x] Match state shown as "Завершено" in matches list

### Exit criteria (plan.md §5, story #5)
- [x] 5/4/5 + comment persists; ratee's average updates
- [x] Skip path works and marks the match accordingly
- [x] Profile shows 4.7-style average + last 3 comments (API: `GET /users/:id/rating-summary`)
