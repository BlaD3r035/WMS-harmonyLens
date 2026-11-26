import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

export const PASSWORD = 'Correct-Horse-9';

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

export async function insertUser(
  role: string,
  options: { email?: string; active?: boolean } = {},
): Promise<string> {
  const email =
    options.email ??
    `${role}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  await withDb((db) =>
    db.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `Test ${role}`,
        email,
        bcrypt.hashSync(PASSWORD, 4),
        role,
        options.active ?? true,
      ],
    ),
  );
  return email;
}

/** Returns a supertest agent that keeps the session cookie after login. */
export async function loginAs(app: INestApplication, email: string) {
  const agent = request.agent(app.getHttpServer());
  await agent
    .post('/api/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return agent;
}

export async function agentFor(app: INestApplication, role: string) {
  return loginAs(app, await insertUser(role));
}

let counter = 0;
export const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${++counter}`;

export async function createLens(
  agent: ReturnType<typeof request.agent>,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; code: string }> {
  const res = await agent
    .post('/api/lenses')
    .send({
      code: unique('LNS'),
      description: 'Lente de prueba',
      sphere: -1.5,
      cylinder: -0.75,
      minStock: 0,
      ...overrides,
    })
    .expect(201);
  return res.body;
}
