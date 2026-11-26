import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ImportDetail, ImportSummary } from '@harmonylens/shared';
import { DatabaseService } from '../db/database.service.js';
import {
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
  duplicateValue,
  isPgError,
} from '../db/pg-errors.js';
import { LOT_SELECT, toLot } from '../lots/lot.queries.js';
import type { LotRow } from '../lots/lot.queries.js';
import type { CreateImportDto } from './import.schemas.js';

interface ImportRow {
  id: string;
  distributor: string;
  invoice_number: string | null;
  manufacturer: string | null;
  notes: string | null;
  received_at: Date;
  created_by_name: string | null;
  lot_count: number;
  total_units: number;
}

const SUMMARY_SELECT = `
  SELECT i.id, i.distributor, i.invoice_number, i.manufacturer, i.notes,
         i.received_at, u.full_name AS created_by_name,
         count(l.id)::int AS lot_count,
         COALESCE(sum(l.quantity_received), 0)::int AS total_units
  FROM imports i
  LEFT JOIN users u ON u.id = i.created_by
  LEFT JOIN lots l ON l.import_id = i.id`;

const toSummary = (r: ImportRow): ImportSummary => ({
  id: r.id,
  distributor: r.distributor,
  invoiceNumber: r.invoice_number,
  manufacturer: r.manufacturer,
  notes: r.notes,
  receivedAt: r.received_at.toISOString(),
  createdByName: r.created_by_name,
  lotCount: r.lot_count,
  totalUnits: r.total_units,
});

@Injectable()
export class ImportsService {
  constructor(private readonly db: DatabaseService) {}

  async list(): Promise<ImportSummary[]> {
    const rows = await this.db.query<ImportRow>(
      `${SUMMARY_SELECT} GROUP BY i.id, u.full_name
       ORDER BY i.received_at DESC LIMIT 200`,
    );
    return rows.map(toSummary);
  }

  async get(id: string): Promise<ImportDetail> {
    const row = await this.db.one<ImportRow>(
      `${SUMMARY_SELECT} WHERE i.id = $1 GROUP BY i.id, u.full_name`,
      [id],
    );
    if (!row) throw new NotFoundException('Importación no encontrada');
    const lots = await this.db.query<LotRow>(
      `${LOT_SELECT} WHERE l.import_id = $1 ORDER BY l.lot_number`,
      [id],
    );
    return { ...toSummary(row), lots: lots.map(toLot) };
  }

  /**
   * Registers the arrival and one lot per line, all in a single transaction.
   * Every lot starts as "pendiente_revision" (quarantine) with its stock
   * recorded, and its history starts with a "recepcion" event.
   */
  async create(dto: CreateImportDto, userId: string): Promise<ImportDetail> {
    try {
      const importId = await this.db.transaction(async (client) => {
        const header = await client.query<{ id: string }>(
          `INSERT INTO imports (distributor, invoice_number, manufacturer, notes, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [
            dto.distributor,
            dto.invoiceNumber,
            dto.manufacturer,
            dto.notes,
            userId,
          ],
        );
        const id = header.rows[0].id;

        for (const lot of dto.lots) {
          const created = await client.query<{ id: string }>(
            `INSERT INTO lots (lot_number, import_id, lens_id, invima_registration,
                               box_count, quantity_received, quality_notes, location_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [
              lot.lotNumber,
              id,
              lot.lensId,
              lot.invimaRegistration,
              lot.boxCount,
              lot.quantity,
              lot.qualityNotes,
              lot.locationId,
            ],
          );
          const lotId = created.rows[0].id;
          await client.query(
            'INSERT INTO lot_inventory (lot_id, quantity) VALUES ($1, $2)',
            [lotId, lot.quantity],
          );
          await client.query(
            `INSERT INTO lot_events (lot_id, event_type, performed_by, details)
             VALUES ($1, 'recepcion', $2, $3)`,
            [lotId, userId, `${lot.quantity} lentes en ${lot.boxCount} cajas`],
          );
          if (lot.locationId) {
            await client.query(
              `INSERT INTO lot_events (lot_id, event_type, performed_by, details)
               SELECT $1, 'ubicacion', $2, code FROM warehouse_locations WHERE id = $3`,
              [lotId, userId, lot.locationId],
            );
          }
        }
        return id;
      });
      return await this.get(importId);
    } catch (error) {
      throw this.translate(error, dto);
    }
  }

  private translate(error: unknown, dto: CreateImportDto): unknown {
    if (!isPgError(error)) return error;

    if (
      error.code === PG_UNIQUE_VIOLATION &&
      error.constraint === 'lots_lot_number_key'
    ) {
      const value = duplicateValue(error);
      const index = dto.lots.findIndex((l) => l.lotNumber === value);
      const message = 'Este número de lote ya está registrado';
      return new ConflictException({
        statusCode: 409,
        message: value ? `El lote "${value}" ya está registrado` : message,
        errors:
          index >= 0 ? { [`lots.${index}.lotNumber`]: message } : undefined,
      });
    }
    if (error.code === PG_FOREIGN_KEY_VIOLATION) {
      const isLocation = error.constraint?.includes('location');
      return new BadRequestException(
        isLocation
          ? 'Ubicación no encontrada'
          : 'Referencia de lente no encontrada',
      );
    }
    return error;
  }
}
