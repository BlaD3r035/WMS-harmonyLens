import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Lot } from '@harmonylens/shared';
import { DatabaseService } from '../db/database.service.js';
import { PG_FOREIGN_KEY_VIOLATION, isPgError } from '../db/pg-errors.js';
import { containsPattern } from '../db/sql.js';
import { LOT_SELECT, toLot } from './lot.queries.js';
import type { LotRow } from './lot.queries.js';
import type { LotQuery } from './lot.schemas.js';

@Injectable()
export class LotsService {
  constructor(private readonly db: DatabaseService) {}

  async list(query: LotQuery): Promise<Lot[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      params.push(value);
      where.push(clause.replaceAll('?', `$${params.length}`));
    };
    if (query.status) add('l.status = ?', query.status);
    if (query.lensId) add('l.lens_id = ?', query.lensId);
    if (query.q) {
      add(
        '(l.lot_number ILIKE ? OR le.code ILIKE ? OR le.description ILIKE ?)',
        containsPattern(query.q),
      );
    }

    const sql = `${LOT_SELECT}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY l.received_at, l.lot_number LIMIT 500`;
    const rows = await this.db.query<LotRow>(sql, params);
    return rows.map(toLot);
  }

  async get(id: string): Promise<Lot> {
    const row = await this.db.one<LotRow>(`${LOT_SELECT} WHERE l.id = $1`, [
      id,
    ]);
    if (!row) throw new NotFoundException('Lote no encontrado');
    return toLot(row);
  }

  approve(id: string, userId: string): Promise<Lot> {
    return this.decide(id, userId, 'autorizado', null);
  }

  reject(id: string, userId: string, reason: string): Promise<Lot> {
    return this.decide(id, userId, 'rechazado', reason);
  }

  /**
   * Moves a lot out of review. The conditional UPDATE makes the decision
   * atomic: two reviewers cannot both decide the same lot.
   */
  private async decide(
    id: string,
    userId: string,
    status: 'autorizado' | 'rechazado',
    reason: string | null,
  ): Promise<Lot> {
    const decided = await this.db.transaction(async (client) => {
      const updated = await client.query(
        `UPDATE lots
         SET status = $2, decided_by = $3, decided_at = now(),
             rejection_reason = $4, updated_at = now()
         WHERE id = $1 AND status = 'pendiente_revision'
         RETURNING id`,
        [id, status, userId, reason],
      );
      if (updated.rowCount === 0) return false;
      await client.query(
        `INSERT INTO lot_events (lot_id, event_type, performed_by, details)
         VALUES ($1, $2, $3, $4)`,
        [
          id,
          status === 'autorizado' ? 'autorizacion' : 'rechazo',
          userId,
          reason,
        ],
      );
      return true;
    });

    if (!decided) {
      const exists = await this.db.one('SELECT 1 FROM lots WHERE id = $1', [
        id,
      ]);
      if (!exists) throw new NotFoundException('Lote no encontrado');
      throw new ConflictException('Este lote ya fue revisado');
    }
    return this.get(id);
  }

  async assignLocation(
    id: string,
    locationId: string,
    userId: string,
  ): Promise<Lot> {
    try {
      const found = await this.db.transaction(async (client) => {
        const updated = await client.query(
          `UPDATE lots SET location_id = $2, updated_at = now()
           WHERE id = $1 RETURNING id`,
          [id, locationId],
        );
        if (updated.rowCount === 0) return false;
        await client.query(
          `INSERT INTO lot_events (lot_id, event_type, performed_by, details)
           SELECT $1, 'ubicacion', $3, code FROM warehouse_locations WHERE id = $2`,
          [id, locationId, userId],
        );
        return true;
      });
      if (!found) throw new NotFoundException('Lote no encontrado');
    } catch (error) {
      if (isPgError(error) && error.code === PG_FOREIGN_KEY_VIOLATION) {
        throw new NotFoundException('Ubicación no encontrada');
      }
      throw error;
    }
    return this.get(id);
  }
}
