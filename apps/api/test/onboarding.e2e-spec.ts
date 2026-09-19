import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { closeTestApp, createTestApp } from './helpers';

/**
 * Story #6 exit criteria (except the mobile-only resume scenario):
 * value preview before email, gyms for geo/manual picker, register keeps onboarding selections.
 */
describe('Onboarding API (story #6)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await seedMinimalData(app);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /gyms is public and lists gyms', async () => {
    const res = await request(app.getHttpServer()).get('/gyms').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).not.toHaveProperty('distanceKm');
  });

  it('GET /gyms?near= sorts by distance and rounds distanceKm', async () => {
    const res = await request(app.getHttpServer())
      .get('/gyms')
      .query({ near: '50.47,30.51' }) // ~Podil
      .expect(200);
    const names = res.body.map((g: { name: string }) => g.name);
    expect(names[0]).toBe('SportLife Поділ');
    expect(res.body[0].distanceKm).toBeLessThan(1);
  });

  it('GET /gyms?near= rejects malformed coordinates', async () => {
    await request(app.getHttpServer()).get('/gyms').query({ near: 'kyiv!' }).expect(400);
  });

  it('GET /matching/preview is public, returns anonymized cards only (no PII)', async () => {
    const res = await request(app.getHttpServer())
      .get('/matching/preview')
      .query({ goal: 'MASS', level: 'BEGINNER' })
      .expect(200);
    expect(res.body.cards.length).toBeGreaterThanOrEqual(3);
    expect(res.body.cards.length).toBeLessThanOrEqual(5);
    for (const card of res.body.cards) {
      expect(card).not.toHaveProperty('email');
      expect(card).not.toHaveProperty('id');
      expect(card).not.toHaveProperty('photoUrl');
      expect(typeof card.firstName).toBe('string');
      expect(card.firstName).not.toContain(' '); // first name only — anonymized
    }
  });

  it('GET /matching/preview relaxes filters so the user always sees >=3 cards', async () => {
    const res = await request(app.getHttpServer())
      .get('/matching/preview')
      .query({ goal: 'MASS', level: 'ADVANCED' }) // no seeded user has both
      .expect(200);
    expect(res.body.cards.length).toBeGreaterThanOrEqual(3);
  });

  it('GET /matching/preview rejects invalid enum values', async () => {
    await request(app.getHttpServer()).get('/matching/preview').query({ goal: 'NOPE' }).expect(400);
  });

  it('POST /auth/register persists onboarding selections into the profile', async () => {
    const gyms = await request(app.getHttpServer()).get('/gyms');
    const gymId = gyms.body[0].id;

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'new.user@example.com', password: 'password123', name: 'Новий Користувач', goal: 'CUT', level: 'BEGINNER', gymId })
      .expect(201);
    expect(res.body.user).toMatchObject({ email: 'new.user@example.com', goal: 'CUT', level: 'BEGINNER', gymId });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.tokens.accessToken).toBeTruthy();
    expect(res.body.tokens.refreshToken).toBeTruthy();
  });

  it('POST /auth/register rejects duplicate emails (409)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dup@example.com', password: 'password123', name: 'Раз' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dup@example.com', password: 'password123', name: 'Два' })
      .expect(409);
  });

  it('rate limiter kicks in when the limit is 1', async () => {
    // Fresh app instance with a tight limit via env is overkill; instead test the guard directly.
    const { RateLimitGuard } = await import('../src/common/guards/rate-limit.guard');
    const guard = new RateLimitGuard(1);
    const ctx = (ip: string) =>
      ({ switchToHttp: () => ({ getRequest: () => ({ ip }) }) }) as never;
    expect(guard.canActivate(ctx('1.1.1.1'))).toBe(true);
    expect(() => guard.canActivate(ctx('1.1.1.1'))).toThrow(/Too many requests/);
    expect(guard.canActivate(ctx('2.2.2.2'))).toBe(true); // per-IP isolation
  });
});

async function seedMinimalData(app: INestApplication) {
  const { PrismaService } = await import('../src/prisma/prisma.service');
  const prisma = app.get(PrismaService);
  const bcrypt = await import('bcrypt');

  await prisma.gym.createMany({
    data: [
      { id: '00000000-0000-4000-8000-000000000101', name: 'SportLife Поділ', city: 'Київ', lat: 50.4703, lng: 30.5147 },
      { id: '00000000-0000-4000-8000-000000000102', name: 'SportLife Либідська', city: 'Київ', lat: 50.4129, lng: 30.5242 },
    ],
  });
  const gym = await prisma.gym.findUnique({ where: { id: '00000000-0000-4000-8000-000000000101' } });
  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.createMany({
    data: [
      { email: 'a1@test.dev', name: 'Саша А', passwordHash, gymId: gym!.id, goal: 'MASS', level: 'BEGINNER' },
      { email: 'a2@test.dev', name: 'Богдан Б', passwordHash, gymId: gym!.id, goal: 'CUT', level: 'INTERMEDIATE' },
      { email: 'a3@test.dev', name: 'Василь В', passwordHash, gymId: gym!.id, goal: 'STRENGTH', level: 'ADVANCED' },
      { email: 'a4@test.dev', name: 'Григорій Г', passwordHash, gymId: gym!.id, goal: 'MASS', level: 'BEGINNER' },
      { email: 'a5@test.dev', name: 'Данило Д', passwordHash, gymId: gym!.id, goal: 'GENERAL', level: 'BEGINNER' },
      { email: 'a6@test.dev', name: 'Євген Є', passwordHash, gymId: gym!.id, goal: 'ENDURANCE', level: 'INTERMEDIATE' },
    ],
  });
}
