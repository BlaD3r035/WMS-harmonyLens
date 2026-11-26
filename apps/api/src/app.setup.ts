import type { INestApplication } from '@nestjs/common';
import type { Express } from 'express';
import { env } from './config/env.js';

/** Settings shared by the real server and the e2e tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: env.CLIENT_ORIGIN, credentials: true });
  (app.getHttpAdapter().getInstance() as Express).disable('x-powered-by');
}
