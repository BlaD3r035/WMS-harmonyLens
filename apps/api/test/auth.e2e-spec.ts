import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  PASSWORD,
  agentFor,
  createApp,
  insertUser,
  loginAs,
  unique,
  withDb,
} from './helpers.js';

describe('auth and user registration (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(() => app.close());

  it('rejects wrong credentials with the same message for unknown email and bad password', async () => {
    const email = await insertUser('jefe_almacen');
    const wrongPw = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'nope-nope-nope' });
    const unknown = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'ghost@test.local', password: PASSWORD });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toBe(wrongPw.body.message);
  });

  it('logs in with an httpOnly SameSite=Strict cookie, never exposing the hash', async () => {
    const email = await insertUser('jefe_almacen', {
      email: `Mixed.Case-${unique('x')}@Test.local`,
    });
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: email.toUpperCase(), password: PASSWORD })
      .expect(200);
    expect(res.body).toMatchObject({ role: 'jefe_almacen' });
    expect(JSON.stringify(res.body)).not.toMatch(/hash|password/i);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/hl_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  it('protects routes: 401 without a session, GET /auth/me with one', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    await request(app.getHttpServer()).get('/api/lots').expect(401);
    const agent = await agentFor(app, 'director_tecnico');
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.role).toBe('director_tecnico');
  });

  it('rejects a forged or tampered token', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', 'hl_session=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.')
      .expect(401);
  });

  it('logout clears the cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .expect(204);
    expect(String(res.headers['set-cookie'])).toMatch(/hl_session=;/);
  });

  it('a deactivated user loses access immediately, even with a valid token', async () => {
    const email = await insertUser('jefe_almacen');
    const agent = await loginAs(app, email);
    await agent.get('/api/auth/me').expect(200);
    await withDb((db) =>
      db.query('UPDATE users SET is_active = false WHERE email = $1', [email]),
    );
    await agent.get('/api/auth/me').expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(401);
  });

  it('throttles repeated failed logins for the same email', async () => {
    const email = await insertUser('jefe_almacen');
    let last = 0;
    for (let i = 0; i < 9; i++) {
      last = (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email, password: 'wrong-wrong-1' })
      ).status;
    }
    expect(last).toBe(429);
    // Even the right password is refused while blocked.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(429);
  });

  describe('register (admin only)', () => {
    const body = () => ({
      fullName: 'Nuevo Usuario',
      email: `${unique('new')}@test.local`,
      password: 'long-enough-pw',
      role: 'auxiliar_bodega',
    });

    it('forbids non-admins and anonymous callers', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .send(body())
        .expect(401);
      const jefe = await agentFor(app, 'jefe_almacen');
      await jefe.post('/api/users').send(body()).expect(403);
      await jefe.get('/api/users').expect(403);
    });

    it('lets an admin register a user who can then log in', async () => {
      const admin = await agentFor(app, 'admin');
      const payload = body();
      const res = await admin.post('/api/users').send(payload).expect(201);
      expect(res.body).toMatchObject({
        email: payload.email,
        role: 'auxiliar_bodega',
      });
      expect(JSON.stringify(res.body)).not.toMatch(/hash|password/i);
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: payload.email, password: payload.password })
        .expect(200);
    });

    it('stores a bcrypt hash, not the password', async () => {
      const admin = await agentFor(app, 'admin');
      const payload = body();
      await admin.post('/api/users').send(payload).expect(201);
      const { rows } = await withDb((db) =>
        db.query('SELECT password_hash FROM users WHERE email = $1', [
          payload.email,
        ]),
      );
      expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/);
      expect(rows[0].password_hash).not.toContain(payload.password);
    });

    it('returns 409 for a duplicate email regardless of case', async () => {
      const admin = await agentFor(app, 'admin');
      const payload = body();
      await admin.post('/api/users').send(payload).expect(201);
      const dup = await admin
        .post('/api/users')
        .send({ ...payload, email: payload.email.toUpperCase() })
        .expect(409);
      expect(dup.body.errors.email).toBeDefined();
    });

    it('validates input with field-level messages', async () => {
      const admin = await agentFor(app, 'admin');
      const res = await admin
        .post('/api/users')
        .send({
          fullName: '',
          email: 'not-an-email',
          password: 'short',
          role: 'root',
        })
        .expect(400);
      expect(Object.keys(res.body.errors).sort()).toEqual([
        'email',
        'fullName',
        'password',
        'role',
      ]);
    });
  });
});
