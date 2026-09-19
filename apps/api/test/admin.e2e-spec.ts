import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import * as bcrypt from 'bcrypt';
import { closeTestApp, createTestApp } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Story #3 exit criteria end-to-end:
 * search by email -> full card -> block (access revoked instantly, matches notified,
 * audit written) -> unblock (access restored, user pushed).
 */
describe('Admin moderation (story #3)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  let adminToken = '';
  let userToken = '';
  let userId = '';
  let partnerId = '';

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);

    await prisma.user.create({
      data: { email: 'admin@test.dev', name: 'Адмін', role: 'ADMIN', passwordHash: await bcrypt.hash('adminpass123', 10) },
    });
    const target = await prisma.user.create({
      data: {
        email: 'toxic_user@mail.com',
        name: 'Токсич Юзер',
        passwordHash: await bcrypt.hash('password123', 10),
        goal: 'MASS',
        level: 'INTERMEDIATE',
      },
    });
    userId = target.id;
    const partner = await prisma.user.create({
      data: { email: 'partner@test.dev', name: 'Партнер Хороший', passwordHash: await bcrypt.hash('password123', 10) },
    });
    partnerId = partner.id;
    await prisma.match.create({ data: { userAId: userId, userBId: partnerId, status: 'ACTIVE' } });
    await prisma.deviceToken.create({ data: { userId: partnerId, platform: 'android', token: 'partner-fcm-token-1234567890' } });
    await prisma.deviceToken.create({ data: { userId, platform: 'ios', token: 'target-fcm-token-1234567890' } });

    const login = (e: string, p: string) => request(server).post('/auth/login').send({ email: e, password: p });
    adminToken = (await login('admin@test.dev', 'adminpass123').expect(200)).body.tokens.accessToken;
    userToken = (await login('toxic_user@mail.com', 'password123').expect(200)).body.tokens.accessToken;

    // The toxic user got reported twice before the admin showed up (story scene)
    const reporter = await prisma.user.create({
      data: { email: 'reporter@test.dev', name: 'Скаржниця', passwordHash: await bcrypt.hash('password123', 10) },
    });
    const reporterToken = (await login('reporter@test.dev', 'password123').expect(200)).body.tokens.accessToken;
    await prisma.report.create({ data: { reporterId: reporter.id, targetId: userId, reason: 'Недоречні повідомлення', details: 'Сидить і пише дивні речі.' } });
    await request(server)
      .post('/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({ targetId: userId, reason: 'Харасмент', details: 'Коментує зовнішність' })
      .expect(201);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('rejects unauthenticated and non-admin callers', async () => {
    await request(server).get('/admin/users').expect(401);
    await request(server)
      .get('/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('searches a user by email and gets a row with report count', async () => {
    const res = await request(server)
      .get('/admin/users')
      .query({ search: 'toxic_user@mail.com' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({ email: 'toxic_user@mail.com', reportsReceivedCount: 2, status: 'ACTIVE' });
  });

  it('opens the full user card: profile, dated reports, match history, status', async () => {
    const res = await request(server)
      .get(`/admin/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.profile).toMatchObject({ email: 'toxic_user@mail.com', status: 'ACTIVE' });
    expect(res.body.reportsReceived).toHaveLength(2);
    expect(res.body.reportsReceived[0]).toHaveProperty('createdAt');
    expect(res.body.reportsReceived.map((r: { reporter: { email: string } }) => r.reporter.email)).toContain('reporter@test.dev');
    expect(res.body.matches).toHaveLength(1);
    expect(res.body.matches[0]).toMatchObject({ status: 'ACTIVE', partner: { id: partnerId } });
  });

  it('blocks the user with a reason: access is revoked instantly', async () => {
    const res = await request(server)
      .post(`/admin/users/${userId}/block`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Недоречні повідомлення' })
      .expect(201);
    expect(res.body).toMatchObject({ id: userId, status: 'BLOCKED', notifiedMatchPartners: 1 });

    // UserGuard proof: a previously valid access token now fails fast on any endpoint.
    const blocked = await request(server).post('/reports').set('Authorization', `Bearer ${userToken}`).send({});
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('ACCOUNT_BLOCKED');

    // New logins are refused too.
    await request(server).post('/auth/login').send({ email: 'toxic_user@mail.com', password: 'password123' }).expect(403);
  });

  it('pushes the blocked user and every active match partner', async () => {
    const toTarget = await prisma.notification.findMany({ where: { userId, type: 'USER_BLOCKED' } });
    const toPartner = await prisma.notification.findMany({ where: { userId: partnerId, type: 'MATCH_PARTNER_BLOCKED' } });
    expect(toTarget).toHaveLength(1);
    expect((toTarget[0].payload as { body: string }).body).toBe('Обліковий запис заблоковано');
    expect(toPartner).toHaveLength(1);
    expect((toPartner[0].payload as { body: string }).body).toBe('Користувача заблоковано адміністрацією');
    expect(toPartner[0].sentAt).not.toBeNull(); // partner has a device token -> delivered (log provider)
  });

  it('writes the block action to the audit log with actor, action, reason', async () => {
    const res = await request(server)
      .get('/admin/audit-log')
      .query({ targetId: userId })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const block = res.body.items.find((i: { action: string }) => i.action === 'BLOCK_USER');
    expect(block).toBeTruthy();
    expect(block).toMatchObject({ targetType: 'user', targetId: userId, meta: { reason: 'Недоречні повідомлення', notifiedMatchPartners: 1 } });
    expect(block.actorId).toBeTruthy();
    expect(block.createdAt).toBeTruthy();
  });

  it('requires a reason for blocking', async () => {
    await request(server)
      .post(`/admin/users/${userId}/block`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: '' })
      .expect(400);
  });

  it('unblocks the user: status active, access restored, user pushed, audit written', async () => {
    await request(server)
      .post(`/admin/users/${userId}/unblock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const login = await request(server).post('/auth/login').send({ email: 'toxic_user@mail.com', password: 'password123' }).expect(200);
    const freshToken = login.body.tokens.accessToken;
    await request(server)
      .post('/devices')
      .set('Authorization', `Bearer ${freshToken}`)
      .send({ platform: 'ios', token: 'a-fresh-device-token-after-unblock-123' })
      .expect(204);

    const pushes = await prisma.notification.findMany({ where: { userId, type: 'USER_UNBLOCKED' } });
    expect(pushes).toHaveLength(1);
    expect((pushes[0].payload as { body: string }).body).toBe('Ваш акаунт розблоковано');

    const audit = await request(server)
      .get('/admin/audit-log')
      .query({ targetId: userId })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(audit.body.items.map((i: { action: string }) => i.action)).toContain('UNBLOCK_USER');
  });

  it('blocks and unblocks are idempotent-ish state checks (409 on invalid transitions)', async () => {
    await request(server)
      .post(`/admin/users/${userId}/unblock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409); // already active
  });

  it('filters the user list by status=BLOCKED', async () => {
    await request(server)
      .post(`/admin/users/${userId}/block`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'повторне блокування для фільтра' })
      .expect(201);
    const res = await request(server)
      .get('/admin/users')
      .query({ status: 'BLOCKED' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].id).toBe(userId);
  });

  it('reports: cannot report yourself', async () => {
    const login = await request(server).post('/auth/login').send({ email: 'reporter@test.dev', password: 'password123' }).expect(200);
    const me = await prisma.user.findUniqueOrThrow({ where: { email: 'reporter@test.dev' } });
    await request(server)
      .post('/reports')
      .set('Authorization', `Bearer ${login.body.tokens.accessToken}`)
      .send({ targetId: me.id, reason: 'самоскарга' })
      .expect(400);
  });
});
