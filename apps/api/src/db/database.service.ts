import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import type { PoolClient, QueryResultRow } from 'pg';
import { env } from '../config/env.js';

// NUMERIC columns here are all small decimals (NUMERIC(4,2)), safe as JS numbers.
pg.types.setTypeParser(1700, (value) => Number.parseFloat(value));

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
  });

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  async one<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T | undefined> {
    return (await this.query<T>(text, params))[0];
  }

  /** Runs `fn` inside a transaction; rolls back if it throws. */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
