import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import * as bcrypt from 'bcrypt';
import { closeTestApp, createTestApp } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Part 4 exit criteria end-to-end (stories #2 + #5):
 *  - Maria logs 5x80 kg -> Dmytro's dashboard reads identical aggregates (server-side math)
 *  - joint goal needs partner confirmation, shows live progress, completes with a push to both
 *  - 5/4/5 + comment persists; ratee's average updates; skip path marks the match unrated
 *  - reputation is visible on preview cards before any request
 */
describe('Part 4 — shared dashboard (#2) + ratings (#5)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let matchId = '';
  let gymId = '';

  const password = 'password123';
  const USERS = {
    maria: 'maria@dash.dev',
    dmytro: 'dmytro@dash.dev',
    olena: 'olena@rate.dev',
    partner: 'partner@rate.dev',
    skipper: 'skipper@rate.dev',
    ghost: 'ghost@dash.dev',
  };

  async function makeUser(key: keyof typeof USERS, name: string, extra: Record<string, unknown> = {}) {
    const user = await prisma.user.create({
      data: { email: USERS[key], name, passwordHash: await bcrypt.hash(password, 10), ...extra },
    });
    ids[key] = user.id;
    const res = await request(server).post('/auth/login').send({ email: USERS[key], password }).expect(200);
    tokens[key] = res.body.tokens.accessToken;
  }

  const auth = (key: string) => ({ Authorization: `Bearer ${tokens[key]}` });

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);

    gymId = (await prisma.gym.create({ data: { name: 'SportLife Тестова', city: 'Київ', lat: 50.45, lng: 30.52 } })).id;
    await makeUser('maria', 'Марія Блогерка', { gymId });
    await makeUser('dmytro', 'Дмитро Напарник', { gymId });
    await makeUser('olena', 'Олена Перекладачка', { gymId });
    await makeUser('partner', 'Гарний Напарник', { gymId });
    await makeUser('skipper', 'Тихий Пропускник');
    await makeUser('ghost', 'Сторонній Чувак');

    matchId = (await prisma.match.create({ data: { userAId: ids.maria, userBId: ids.dmytro, status: 'ACTIVE' } })).id;
  });

  afterAll(() => closeTestApp());

  describe('dashboard (#2)', () => {
    it('Maria logs 5x80 kg -> Dmytro fetches identical aggregates (count=1, totalKg=400)', async () => {
      await request(server)
        .post(`/matches/${matchId}/workouts`)
        .set(auth('maria'))
        .send({ date: '2026-08-20', type: 'жим лежачи', sets: 5, weightKg: 80 })
        .expect(201);

      const [mariaView, dmytroView] = await Promise.all([
        request(server).get(`/matches/${matchId}/dashboard`).set(auth('maria')).expect(200),
        request(server).get(`/matches/${matchId}/dashboard`).set(auth('dmytro')).expect(200),
      ]);

      expect(dmytroView.body.stats).toMatchObject({ workoutCount: 1, totalKg: 400 }); // streak: unit-tested in stats.spec
      expect(dmytroView.body.stats).toEqual(mariaView.body.stats); // consistency rule: identical numbers
      expect(dmytroView.body.workouts[0]).toMatchObject({
        type: 'жим лежачи',
        sets: 5,
        weightKg: 80,
        user: { id: ids.maria, name: 'Марія' }, // "who attended" mark
      });
    });

    it('goal: propose -> partner push -> only partner can confirm -> live progress -> done push to both', async () => {
      const goal = (
        await request(server)
          .post(`/matches/${matchId}/goals`)
          .set(auth('maria'))
          .send({ title: '2 тренування за серпень', target: 2, metric: 'WORKOUT_COUNT', due: '2026-08-31' })
          .expect(201)
      ).body;
      expect(goal).toMatchObject({ status: 'PENDING_CONFIRM', progress: 1 }); // existing workout counts (Gherkin 8/10)

      const confirmPush = await prisma.notification.findFirst({
        where: { userId: ids.dmytro, type: 'GOAL_CONFIRM_REQUEST' },
        orderBy: { createdAt: 'desc' },
      });
      expect(confirmPush?.payload).toMatchObject({
        body: 'Марія пропонує спільну ціль: «2 тренування за серпень»',
        data: { matchId, goalId: goal.id },
      });

      // creator cannot confirm their own goal
      await request(server).post(`/matches/${matchId}/goals/${goal.id}/confirm`).set(auth('maria')).expect(409);

      const confirmed = (
        await request(server).post(`/matches/${matchId}/goals/${goal.id}/confirm`).set(auth('dmytro')).expect(201)
      ).body;
      expect(confirmed).toMatchObject({ status: 'ACTIVE', progress: 1 });

      // second workout hits 2/2 -> DONE + "Ціль виконано! 🎉" to BOTH partners
      await request(server)
        .post(`/matches/${matchId}/workouts`)
        .set(auth('dmytro'))
        .send({ date: '2026-08-25', type: 'присідання', sets: 4, reps: 10, weightKg: 60 })
        .expect(201);

      const view = (await request(server).get(`/matches/${matchId}/dashboard`).set(auth('maria')).expect(200)).body;
      expect(view.goals[0]).toMatchObject({ status: 'DONE', progress: 2 });
      expect(view.stats).toMatchObject({ workoutCount: 2, totalKg: 400 + 2400 });

      for (const uid of [ids.maria, ids.dmytro]) {
        const done = await prisma.notification.findFirst({
          where: { userId: uid, type: 'GOAL_COMPLETED' },
          orderBy: { createdAt: 'desc' },
        });
        expect(done?.payload).toMatchObject({ body: 'Ціль виконано! 🎉 «2 тренування за серпень»' });
      }
    });

    it('access + validation: stranger 404, bad input 400, writes on ended match 409', async () => {
      await request(server).get(`/matches/${matchId}/dashboard`).set(auth('ghost')).expect(404);
      await request(server)
        .post(`/matches/${matchId}/workouts`)
        .set(auth('ghost'))
        .send({ date: '2026-08-20', type: 'x' })
        .expect(404);
      await request(server)
        .post(`/matches/${matchId}/workouts`)
        .set(auth('maria'))
        .send({ date: '2026-08-20', type: '   ' })
        .expect(400);

      const ended = await prisma.match.create({ data: { userAId: ids.maria, userBId: ids.skipper, status: 'ENDED' } });
      await request(server)
        .post(`/matches/${ended.id}/workouts`)
        .set(auth('maria'))
        .send({ date: '2026-08-20', type: 'ноги' })
        .expect(409);
      // ...but reading an ended match's dashboard stays open (history)
      await request(server).get(`/matches/${ended.id}/dashboard`).set(auth('maria')).expect(200);
    });
  });

  describe('ratings (#5)', () => {
    let rateMatchId = '';

    beforeAll(async () => {
      rateMatchId = (
        await prisma.match.create({ data: { userAId: ids.olena, userBId: ids.partner, status: 'ACTIVE' } })
      ).id;
    });

    it('5/4/5 + comment persists; ratee average becomes 4.7 with the comment listed', async () => {
      const res = await request(server)
        .post(`/matches/${rateMatchId}/complete`)
        .set(auth('olena'))
        .send({ rating: { punctuality: 5, communication: 4, spotting: 5, comment: 'Чудовий напарник!' } })
        .expect(201);

      expect(res.body).toMatchObject({
        status: 'ENDED',
        ratingSkipped: false,
        rating: { raterId: ids.olena, rateeId: ids.partner, punctuality: 5, communication: 4, spotting: 5 },
      });

      const summary = (await request(server).get(`/users/${ids.partner}/rating-summary`).set(auth('olena')).expect(200))
        .body;
      expect(summary.average).toBe(4.7); // (5+4+5)/3 = 4.66... -> 4.7
      expect(summary.count).toBe(1);
      expect(summary.comments[0]).toMatchObject({ comment: 'Чудовий напарник!', authorName: 'Олена', score: 4.7 });
    });

    it('one rating per rater per match: re-complete is rejected', async () => {
      await request(server)
        .post(`/matches/${rateMatchId}/complete`)
        .set(auth('olena'))
        .send({ rating: { punctuality: 1, communication: 1, spotting: 1 } })
        .expect(409);
      expect(await prisma.rating.count({ where: { matchId: rateMatchId } })).toBe(1);
    });

    it('skip path: empty body ends the match unrated ("Завершено без оцінки")', async () => {
      const m = await prisma.match.create({ data: { userAId: ids.skipper, userBId: ids.maria, status: 'ACTIVE' } });
      const res = await request(server).post(`/matches/${m.id}/complete`).set(auth('skipper')).send({}).expect(201);

      expect(res.body).toMatchObject({ status: 'ENDED', rating: null, ratingSkipped: true });
      expect(await prisma.rating.count({ where: { matchId: m.id } })).toBe(0);
    });

    it('unrated user summary: average null, count 0; strangers still 404 on complete', async () => {
      const summary = (await request(server).get(`/users/${ids.ghost}/rating-summary`).set(auth('maria')).expect(200))
        .body;
      expect(summary).toMatchObject({ average: null, count: 0, comments: [] });

      const m = await prisma.match.create({ data: { userAId: ids.olena, userBId: ids.skipper, status: 'ACTIVE' } });
      await request(server).post(`/matches/${m.id}/complete`).set(auth('ghost')).send({}).expect(404);
    });

    it('reputation shows on preview cards before any request (aggregate only)', async () => {
      const res = await request(server).get(`/matching/preview?gym_id=${gymId}`).expect(200);
      const card = res.body.cards.find((c: { firstName: string }) => c.firstName === 'Гарний');
      expect(card).toMatchObject({ ratingAverage: 4.7, ratingCount: 1 });
      expect(JSON.stringify(card)).not.toContain('Чудовий напарник'); // comments stay behind auth
    });
  });
});
