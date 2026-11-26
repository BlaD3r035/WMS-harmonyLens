import { existsSync } from 'node:fs';
import { z } from 'zod';

// The monorepo keeps a single .env at the repository root. Variables already
// present in the process environment win over the file.
const rootEnv = new URL('../../../../.env', import.meta.url);
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = parsed.data;
