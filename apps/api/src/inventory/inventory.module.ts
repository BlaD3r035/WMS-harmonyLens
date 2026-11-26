import { Controller, Get, Module, Query } from '@nestjs/common';
import { z } from 'zod';
import type { InventoryReference, StockState } from '@harmonylens/shared';
import { Roles } from '../auth/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DatabaseService } from '../db/database.service.js';
import { containsPattern } from '../db/sql.js';

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  state: z.enum(['agotada', 'bajo', 'ok']).optional(),
});

interface ReferenceRow {
  lens_id: string;
  code: string;
  description: string;
  sphere: number;
  cylinder: number;
  min_stock: number;
  available: number;
  quarantine: number;
}

/**
 * HU11.2 / HU11.3. Only units in authorized lots count as available.
 * "agotada" (no units) takes precedence over "bajo" (at or below the minimum).
 */
export const stockState = (available: number, minStock: number): StockState =>
  available === 0 ? 'agotada' : available <= minStock ? 'bajo' : 'ok';

@Controller('inventory')
@Roles('jefe_almacen', 'auxiliar_bodega', 'director_tecnico')
class InventoryController {
  constructor(private readonly db: DatabaseService) {}

  @Get('references')
  async references(
    @Query(new ZodPipe(querySchema)) query: z.infer<typeof querySchema>,
  ): Promise<InventoryReference[]> {
    const rows = await this.db.query<ReferenceRow>(
      `SELECT le.id AS lens_id, le.code, le.description, le.sphere, le.cylinder,
              le.min_stock,
              COALESCE(sum(inv.quantity) FILTER (WHERE l.status = 'autorizado'), 0)::int AS available,
              COALESCE(sum(inv.quantity) FILTER (WHERE l.status = 'pendiente_revision'), 0)::int AS quarantine
       FROM lenses le
       LEFT JOIN lots l ON l.lens_id = le.id
       LEFT JOIN lot_inventory inv ON inv.lot_id = l.id
       WHERE ($1::text IS NULL OR le.code ILIKE $1 OR le.description ILIKE $1)
       GROUP BY le.id
       ORDER BY le.code`,
      [query.q ? containsPattern(query.q) : null],
    );
    return rows
      .map<InventoryReference>((r) => ({
        lensId: r.lens_id,
        code: r.code,
        description: r.description,
        sphere: r.sphere,
        cylinder: r.cylinder,
        minStock: r.min_stock,
        available: r.available,
        quarantine: r.quarantine,
        state: stockState(r.available, r.min_stock),
      }))
      .filter((r) => !query.state || r.state === query.state);
  }
}

@Module({ controllers: [InventoryController] })
export class InventoryModule {}
