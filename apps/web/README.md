# GymBrosUK — web demo (Next.js)

Самостійний Next.js застосунок, який відтворює GymBrosUK як **веб-демо для Vercel одним деплоєм**.
**Тільки мок-дані — без БД.** Усі дані лежать у `lib/mock.ts`.

## Запуск локально

```bash
cd apps/web
pnpm install        # з кореня монорепо: pnpm install
pnpm dev            # http://localhost:3001
```

## Production build

```bash
pnpm build          # next build
pnpm start          # next start -p 3001
```

## Деплой на Vercel (один проєкт)

- **Import** монорепо → Vercel
- **Root Directory**: `apps/web`
- **Build**: `pnpm --filter web build` (або `pnpm build` з `apps/web`)
- **Output**: `apps/web/.next` — Vercel сам підхопить Next.js
- Не потрібні ані Postgres, ані Redis, ані MinIO — застосунок статичний.

## Сторінки

| Шлях | Що |
|---|---|
| `/` | Лендінг |
| `/onboarding` | Онбординг 4 кроки → анонімне превʼю партнерів |
| `/matches` | Пошук партнерів з фільтрами + «Запросити в пару» |
| `/profile` | Редагування профілю (зберігається в localStorage) |
| `/chat` , `/chat/[id]` | Список чатів і вікно переписки (мок) |
| `/dashboard` | Дашборд: тренування, тоннаж, стрік, бейджі |
