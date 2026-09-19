# GymBrosUK — web demo 💪

Один **Next.js** застосунок (`apps/web`), що відтворює продукт GymBrosUK як **веб-демо**.
**Тільки мок-дані, без БД** — деплоїться на Vercel **одним проєктом**.

> Це раніше був монорепо з трьох окремих застосунків (`apps/api` NestJS, `apps/admin` Vite,
> `apps/mobile` Expo). Їхню функціональність і рути перенесено в один Next.js веб-застосунок;
> оригінальний код видалено з main, але він лишається в git-історії (відновлюваний).

## Швидкий старт

```bash
pnpm install
pnpm dev          # http://localhost:3001
```

## Build / start

```bash
pnpm build        # next build
pnpm start        # next start -p 3001
```

## Деплой на Vercel (один проєкт)

- Import монорепо → Vercel
- **Root Directory**: `apps/web`
- **Build**: `pnpm --filter web build`
- Output `.next` — Vercel підхоплює Next.js автоматично. Postgres/Redis/MinIO **не потрібні**.

## Сторінки (усі екрани трьох застосунків, на мок-даних)

| Шлях | Що | Відповідає |
|---|---|---|
| `/` | Лендінг | — |
| `/login` · `/onboarding` | Авторизація + онбординг (goal→level→gym→preview) | mobile auth/onboarding |
| `/matches` | Пошук партнерів (фільтри, «Запросити») | mobile Matching |
| `/requests` | Вхідні запити (accept/decline) | mobile Requests |
| `/pairs` | Мої пари (чат/розклад/дашборд/оцінка) | mobile Matches |
| `/chat`, `/chat/[id]` | Переписка | mobile Chat |
| `/schedule` | Розклад тренувань | mobile Schedule |
| `/workouts/new` | Додати тренування | mobile WorkoutForm |
| `/goals/new` | Спільна мета | mobile GoalForm |
| `/rating` | Оцінити партнера | mobile RatingForm |
| `/profile`, `/profile/preview` | Профіль і превʼю | mobile Profile |
| `/admin`, `/admin/users`, `/admin/users/[id]` | Адмін-панель (login, search, block) | admin Login/Users/UserDetail |

## Дані

Уся доменна модель і дані — у `apps/web/lib/mock.ts` (дзеркало Prisma-схеми). Змінювані дані (профіль)
зберігаються в `localStorage`.
