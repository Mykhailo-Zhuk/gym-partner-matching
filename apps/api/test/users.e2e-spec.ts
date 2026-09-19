import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { closeTestApp, createTestApp } from './helpers';
import type { Server } from 'node:http';

/**
 * Part 0 exit criterion: "no passwordHash leak".
 * GET/PATCH /users/me return the raw Prisma row shape — regression test
 * after the 2026-08-29 audit found passwordHash leaking on these endpoints.
 */
describe('Users profile (Part 0: no passwordHash leak)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  const email = 'users.me@example.com';
  let accessToken = '';

  beforeAll(async () => {
    const res = await request(server)
      .post('/auth/register')
      .send({ email, password: 'password123', name: 'Профіль Тестер' })
      .expect(201);
    accessToken = res.body.tokens.accessToken as string;
  });

  it('GET /users/me returns the profile without passwordHash', async () => {
    const res = await request(server).get('/users/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(res.body.email).toBe(email);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('PATCH /users/me updates fields and does not leak passwordHash', async () => {
    const res = await request(server)
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bio: 'Люблю базовi вправи', level: 'INTERMEDIATE' })
      .expect(200);
    expect(res.body.bio).toBe('Люблю базовi вправи');
    expect(res.body.level).toBe('INTERMEDIATE');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('GET /auth/me stays clean as well', async () => {
    const res = await request(server).get('/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(res.body.email).toBe(email);
    expect(res.body).not.toHaveProperty('passwordHash');
  });
});