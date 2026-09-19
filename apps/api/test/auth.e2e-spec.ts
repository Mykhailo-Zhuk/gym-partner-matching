import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { closeTestApp, createTestApp } from './helpers';
import type { Server } from 'node:http';

describe('Auth (Part 0 exit criteria)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  const email = 'auth.user@example.com';
  const password = 'password123';
  let accessToken = '';
  let refreshToken = '';

  it('registers and returns a token pair', async () => {
    const res = await request(server).post('/auth/register').send({ email, password, name: 'Авт Тестер' }).expect(201);
    accessToken = res.body.tokens.accessToken;
    refreshToken = res.body.tokens.refreshToken;
    expect(accessToken.split('.')).toHaveLength(3);
  });

  it('logs in with the same credentials', async () => {
    const res = await request(server).post('/auth/login').send({ email, password }).expect(200);
    expect(res.body.tokens.refreshToken).toBeTruthy();
  });

  it('rejects wrong password with 401', async () => {
    await request(server).post('/auth/login').send({ email, password: 'wrong-pass-1' }).expect(401);
  });

  it('rotates refresh tokens: old token dies, new one works', async () => {
    const first = await request(server).post('/auth/refresh').send({ refreshToken }).expect(200);
    const newRefresh = first.body.refreshToken as string;
    expect(newRefresh).not.toBe(refreshToken);

    await request(server).post('/auth/refresh').send({ refreshToken }).expect(401); // reused => revoked
    await request(server).post('/auth/refresh').send({ refreshToken: newRefresh }).expect(200);
  });

  it('social sign-in with a dev token creates the account and accepts onboarding selections', async () => {
    const res = await request(server)
      .post('/auth/social')
      .send({
        provider: 'GOOGLE',
        idToken: 'dev:google-uid-1:social.user@example.com:Соціальний Юзер',
        goal: 'STRENGTH',
        level: 'INTERMEDIATE',
      })
      .expect(200);
    expect(res.body.user).toMatchObject({ email: 'social.user@example.com', goal: 'STRENGTH' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('social sign-in rejects a malformed dev token', async () => {
    await request(server)
      .post('/auth/social')
      .send({ provider: 'APPLE', idToken: 'garbage' })
      .expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const login = await request(server).post('/auth/login').send({ email, password }).expect(200);
    const rt = login.body.tokens.refreshToken;
    await request(server).post('/auth/logout').send({ refreshToken: rt }).expect(204);
    await request(server).post('/auth/refresh').send({ refreshToken: rt }).expect(401);
  });
});
