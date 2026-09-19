import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import * as bcrypt from 'bcrypt';
import { io, type Socket } from 'socket.io-client';
import { closeTestApp, createTestApp } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Part 3 exit criteria end-to-end (stories #7 + #4):
 *  - chat REST history + realtime socket fanout (<=2s, well under the 5s test timeout)
 *  - offline recipient gets an FCM push (recorded Notification row)
 *  - photo messages via the upload pipeline
 *  - access rule: active-match participants only, exact Gherkin 403 message
 *  - scheduling drives reminders; "Я в дорозі" => partner push + chat system message
 *  - ending / blocking a user leaves chat closed (socket killed on block)
 */
describe('Part 3 — chat (#7) + push reminders (#4)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let port: number;

  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let matchId = '';
  let endedMatchId = '';

  const password = 'password123';
  const USERS = {
    a: 'dmytro@chat.dev',
    b: 'oleksii@chat.dev',
    ghost: 'stranger@chat.dev',
    ex: 'expartner@chat.dev',
    pagA: 'paga@chat.dev',
    pagB: 'pagb@chat.dev',
  };

  async function makeUser(key: keyof typeof USERS, name: string) {
    const user = await prisma.user.create({
      data: { email: USERS[key], name, passwordHash: await bcrypt.hash(password, 10) },
    });
    ids[key] = user.id;
    const res = await request(server).post('/auth/login').send({ email: USERS[key], password }).expect(200);
    tokens[key] = res.body.tokens.accessToken;
  }

  function connectChat(token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(`http://127.0.0.1:${port}/chat`, { auth: { token }, transports: ['websocket'] });
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
      setTimeout(() => reject(new Error('socket connect timeout')), 5000);
    });
  }

  function nextEvent(socket: Socket, event: string, timeoutMs = 5000): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
      socket.once(event, (payload: Record<string, unknown>) => {
        clearTimeout(t);
        resolve(payload);
      });
    });
  }

  const sendText = (token: string, match: string, body: string) =>
    request(server).post(`/matches/${match}/messages`).set('Authorization', `Bearer ${token}`).send({ type: 'TEXT', body });

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0); // real port for Socket.io
    server = app.getHttpServer() as Server;
    port = (server.address() as AddressInfo).port;
    prisma = app.get(PrismaService);

    await makeUser('a', 'Дмитро Маркетолог');
    await makeUser('b', 'Олексій Айтішник');
    await makeUser('ghost', 'Сторонній Чувак');
    await makeUser('ex', 'Колишній Партнер');

    const active = await prisma.match.create({ data: { userAId: ids.a, userBId: ids.b, status: 'ACTIVE' } });
    matchId = active.id;
    const ended = await prisma.match.create({ data: { userAId: ids.a, userBId: ids.ex, status: 'ENDED' } });
    endedMatchId = ended.id;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('chat (#7)', () => {
    let socketA: Socket;
    let socketB: Socket;

    afterEach(() => {
      socketA?.disconnect();
      socketB?.disconnect();
    });

    it('realtime: REST send reaches both participants over the socket (multi-device sync)', async () => {
      socketA = await connectChat(tokens.a);
      socketB = await connectChat(tokens.b);

      const [atB, atA] = await Promise.all([
        nextEvent(socketB, 'message:new'),
        nextEvent(socketA, 'message:new'),
        sendText(tokens.a, matchId, 'Бронюй стійку на 19:00').expect(201),
      ]);

      for (const payload of [atB, atA]) {
        expect(payload).toMatchObject({
          matchId,
          senderId: ids.a,
          senderName: 'Дмитро',
          type: 'TEXT',
          body: 'Бронюй стійку на 19:00',
        });
      }
    });

    it('offline recipient: message still persists + NEW_MESSAGE push is recorded', async () => {
      // b is NOT connected here
      await sendText(tokens.a, matchId, 'Ти зараз офлайн?').expect(201);

      const push = await prisma.notification.findFirst({
        where: { userId: ids.b, type: 'NEW_MESSAGE' },
        orderBy: { createdAt: 'desc' },
      });
      expect(push?.payload).toMatchObject({
        title: 'Дмитро',
        body: 'Ти зараз офлайн?',
        data: { matchId, deeplink: `gymbros://matches/${matchId}/chat` },
      });
    });

    it('history: ascending items + keyset pagination via ?before=', async () => {
      const m1 = (await sendText(tokens.a, matchId, 'p1').expect(201)).body;
      const m2 = (await sendText(tokens.b, matchId, 'p2').expect(201)).body;
      const m3 = (await sendText(tokens.a, matchId, 'p3').expect(201)).body;

      const page1 = await request(server)
        .get(`/matches/${matchId}/messages?limit=2`)
        .set('Authorization', `Bearer ${tokens.b}`)
        .expect(200);

      expect(page1.body.items.map((m: { id: string }) => m.id)).toEqual([m2.id, m3.id]);
      expect(page1.body.nextCursor).toBe(m2.id);

      const page2 = await request(server)
        .get(`/matches/${matchId}/messages?limit=2&before=${page1.body.nextCursor}`)
        .set('Authorization', `Bearer ${tokens.b}`)
        .expect(200);

      // earlier messages from the previous tests are on this page too
      const ids2 = page2.body.items.map((m: { id: string }) => m.id);
      expect(ids2).toContain(m1.id);
      expect(page2.body.items.length).toBe(2);
    });

    it('photo message: presign URL accepted, foreign URL rejected', async () => {
      const presign = await request(server)
        .post('/uploads/presign')
        .set('Authorization', `Bearer ${tokens.a}`)
        .send({ kind: 'chat', contentType: 'image/jpeg' })
        .expect(201);

      const res = await request(server)
        .post(`/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${tokens.a}`)
        .send({ type: 'IMAGE', mediaUrl: presign.body.fileUrl })
        .expect(201);
      expect(res.body).toMatchObject({ type: 'IMAGE', mediaUrl: presign.body.fileUrl });

      await request(server)
        .post(`/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${tokens.a}`)
        .send({ type: 'IMAGE', mediaUrl: 'https://evil.example/x.jpg' })
        .expect(400);
    });

    it('validation: empty text rejected', async () => {
      await sendText(tokens.a, matchId, '   ').expect(400);
    });

    it('access rule: stranger gets 404, inactive match gets the exact Gherkin 403', async () => {
      await request(server)
        .get(`/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${tokens.ghost}`)
        .expect(404);
      await sendText(tokens.ghost, matchId, 'hello').expect(404);

      const res = await sendText(tokens.a, endedMatchId, 'ще тренуємось?').expect(403);
      expect(res.body).toMatchObject({ code: 'CHAT_INACTIVE', message: 'Чат доступний тільки для активних матчів' });
      await request(server)
        .get(`/matches/${endedMatchId}/messages`)
        .set('Authorization', `Bearer ${tokens.a}`)
        .expect(403);
    });

    it('pagination is stable across an isolated match (3 messages, page size 2)', async () => {
      await makeUser('pagA', 'Пагінація Один');
      await makeUser('pagB', 'Пагінація Два');
      const m = await prisma.match.create({ data: { userAId: ids.pagA, userBId: ids.pagB, status: 'ACTIVE' } });
      const sent: string[] = [];
      for (const body of ['one', 'two', 'three']) {
        sent.push((await sendText(tokens.pagA, m.id, body).expect(201)).body.id);
      }

      const p1 = await request(server)
        .get(`/matches/${m.id}/messages?limit=2`)
        .set('Authorization', `Bearer ${tokens.pagB}`)
        .expect(200);
      expect(p1.body.items.map((x: { body: string }) => x.body)).toEqual(['two', 'three']);
      expect(p1.body.nextCursor).toBe(sent[1]);

      const p2 = await request(server)
        .get(`/matches/${m.id}/messages?limit=2&before=${p1.body.nextCursor}`)
        .set('Authorization', `Bearer ${tokens.pagB}`)
        .expect(200);
      expect(p2.body.items.map((x: { body: string }) => x.body)).toEqual(['one']);
      expect(p2.body.nextCursor).toBeNull();
    });
  });

  describe('push reminders (#4)', () => {
    it('scheduling: sets scheduled_at; rejects past dates; strangers get 404', async () => {
      const when = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
      const res = await request(server)
        .patch(`/matches/${matchId}/schedule`)
        .set('Authorization', `Bearer ${tokens.a}`)
        .send({ scheduledAt: when })
        .expect(200);
      expect(new Date(res.body.scheduledAt).toISOString()).toBe(new Date(when).toISOString());

      await request(server)
        .patch(`/matches/${matchId}/schedule`)
        .set('Authorization', `Bearer ${tokens.a}`)
        .send({ scheduledAt: new Date(Date.now() - 60_000).toISOString() })
        .expect(400);

      await request(server)
        .patch(`/matches/${matchId}/schedule`)
        .set('Authorization', `Bearer ${tokens.ghost}`)
        .send({ scheduledAt: when })
        .expect(404);

      await request(server)
        .patch(`/matches/${endedMatchId}/schedule`)
        .set('Authorization', `Bearer ${tokens.a}`)
        .send({ scheduledAt: when })
        .expect(409);
    });

    it('"Я в дорозі": partner push "{name} вже в дорозі!" + SYSTEM message lands in chat', async () => {
      const res = await request(server)
        .post(`/matches/${matchId}/en-route`)
        .set('Authorization', `Bearer ${tokens.a}`)
        .expect(201);

      expect(res.body).toMatchObject({
        ok: true,
        systemMessage: { type: 'SYSTEM', senderId: null, body: 'Дмитро в дорозі 🚗' },
      });

      const push = await prisma.notification.findFirst({
        where: { userId: ids.b, type: 'PARTNER_EN_ROUTE' },
        orderBy: { createdAt: 'desc' },
      });
      expect(push?.payload).toMatchObject({
        body: 'Дмитро вже в дорозі!',
        data: { matchId, deeplink: `gymbros://matches/${matchId}/chat` },
      });

      const history = await request(server)
        .get(`/matches/${matchId}/messages`)
        .set('Authorization', `Bearer ${tokens.b}`)
        .expect(200);
      const system = history.body.items.find((m: { type: string }) => m.type === 'SYSTEM');
      expect(system).toMatchObject({ body: 'Дмитро в дорозі 🚗', senderName: null });

      await request(server).post(`/matches/${endedMatchId}/en-route`).set('Authorization', `Bearer ${tokens.a}`).expect(409);
    });

    it('ending a match closes the chat (no orphan reminders — covered by unit specs)', async () => {
      const m = await prisma.match.create({
        data: { userAId: ids.pagA, userBId: ids.pagB, status: 'ACTIVE', scheduledAt: new Date(Date.now() + 2e6) },
      });

      await request(server).post(`/matches/${m.id}/end`).set('Authorization', `Bearer ${tokens.pagA}`).expect(201);
      await request(server).post(`/matches/${m.id}/end`).set('Authorization', `Bearer ${tokens.pagA}`).expect(409);
      await sendText(tokens.pagA, m.id, 'алло?').expect(403);
      await request(server).post(`/matches/${m.id}/end`).set('Authorization', `Bearer ${tokens.ghost}`).expect(404);
    });

    it('admin block kills live chat sockets immediately', async () => {
      const adminPassword = 'adminpass123';
      await prisma.user.create({
        data: {
          email: 'admin@chat.dev',
          name: 'Адмін Чат',
          role: 'ADMIN',
          passwordHash: await bcrypt.hash(adminPassword, 10),
        },
      });
      const adminToken = (
        await request(server).post('/auth/login').send({ email: 'admin@chat.dev', password: adminPassword }).expect(200)
      ).body.tokens.accessToken;

      const socket = await connectChat(tokens.b);
      const dropped = nextEvent(socket, 'disconnect').then(() => true);

      await request(server)
        .post(`/admin/users/${ids.b}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'тест блокування чату' })
        .expect(201);

      await expect(dropped).resolves.toBe(true); // socket force-disconnected server-side

      // and REST is closed for the blocked user too (global UserStatusGuard)
      await sendText(tokens.b, matchId, 'мене ще чутно?').expect(403);

      // Cleanup: unblock `b` so the user-state doesn't leak into later test files
      // (e.g. admin.e2e-spec.ts's "filters by status=BLOCKED" expects a single blocked
      // user — its own. The shared gymbros_test DB survives between files.)
      await request(server)
        .post(`/admin/users/${ids.b}/unblock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
    });
  });
});
