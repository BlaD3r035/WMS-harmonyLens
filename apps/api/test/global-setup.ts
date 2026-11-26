import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

const root = new URL('../../../', import.meta.url);
const TEST_DB = 'harmonylens_test';

/** Recreates an isolated test database from packages/db/schema.sql. */
export default async function setup() {
  const envFile = new URL('.env', root);
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL is required to run e2e tests');

  const adminUrl = new URL(base);
  adminUrl.pathname = '/postgres';
  const testUrl = new URL(base);
  testUrl.pathname = `/${TEST_DB}`;

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  const db = new pg.Client({ connectionString: testUrl.toString() });
  await db.connect();
  await db.query(readFileSync(new URL('packages/db/schema.sql', root), 'utf8'));
  await db.end();

  process.env.DATABASE_URL = testUrl.toString();
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';

  return async () => {
    const cleanup = new pg.Client({ connectionString: adminUrl.toString() });
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
    await cleanup.end();
  };
}
