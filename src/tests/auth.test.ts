import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, clearDb, createUser, loginAs, PASSWORD, startDb, stopDb } from './helpers';

beforeAll(() => startDb('auth'));
afterAll(() => stopDb());
beforeEach(() => clearDb());

describe('auth', () => {
  it('rejects protected routes without a session', async () => {
    const res = await request(app).get('/api/v1/doctors').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a tampered cookie', async () => {
    await request(app).get('/api/v1/auth/me').set('Cookie', 'dt_session=not-a-jwt').expect(401);
  });

  it('returns a generic error for a wrong password or unknown email', async () => {
    await createUser('admin');
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.dev', password: 'nope' })
      .expect(401);
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@test.dev', password: 'nope' })
      .expect(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('validates the login body', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'bad' }).expect(400);
    expect(res.body.error.details).toMatchObject({
      email: expect.any(String),
      password: expect.any(String),
    });
  });

  it('signs in with an httpOnly cookie, returns the user, and signs out', async () => {
    await createUser('admin');
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ADMIN@test.dev', password: PASSWORD })
      .expect(200);
    const cookie = String(login.headers['set-cookie']);
    expect(cookie).toMatch(/dt_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(login.body.data).not.toHaveProperty('passwordHash');

    const agent = await loginAs('admin');
    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.data).toMatchObject({ email: 'admin@test.dev', role: 'admin' });

    const logout = await agent.post('/api/v1/auth/logout').expect(204);
    expect(String(logout.headers['set-cookie'])).toMatch(/dt_session=;/);
  });

  it('forbids staff from mutating data', async () => {
    const staff = await loginAs('staff');
    await staff.get('/api/v1/doctors').expect(200);
    const res = await staff
      .post('/api/v1/doctors')
      .send({
        name: 'Dr. X',
        specialization: 'Cardiology',
        hospital: 'H',
        phone: '123456',
        email: 'x@y.z',
      })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
