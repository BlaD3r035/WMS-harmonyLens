import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Lens } from '@harmonylens/shared';
import { DatabaseService } from '../db/database.service.js';
import { PG_UNIQUE_VIOLATION, isPgError } from '../db/pg-errors.js';
import { containsPattern } from '../db/sql.js';
import type { CreateLensDto, UpdateLensDto } from './lens.schemas.js';

interface LensRow {
  id: string;
  code: string;
  description: string;
  sphere: number;
  cylinder: number;
  min_stock: number;
}

const COLUMNS = 'id, code, description, sphere, cylinder, min_stock';

const toLens = (r: LensRow): Lens => ({
  id: r.id,
  code: r.code,
  description: r.description,
  sphere: r.sphere,
  cylinder: r.cylinder,
  minStock: r.min_stock,
});

@Injectable()
export class LensesService {
  constructor(private readonly db: DatabaseService) {}

  async list(q?: string): Promise<Lens[]> {
    const rows = q
      ? await this.db.query<LensRow>(
          `SELECT ${COLUMNS} FROM lenses
           WHERE code ILIKE $1 OR description ILIKE $1
           ORDER BY code LIMIT 500`,
          [containsPattern(q)],
        )
      : await this.db.query<LensRow>(
          `SELECT ${COLUMNS} FROM lenses ORDER BY code LIMIT 500`,
        );
    return rows.map(toLens);
  }

  async create(dto: CreateLensDto): Promise<Lens> {
    try {
      const row = await this.db.one<LensRow>(
        `INSERT INTO lenses (code, description, sphere, cylinder, min_stock)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
        [dto.code, dto.description, dto.sphere, dto.cylinder, dto.minStock],
      );
      return toLens(row!);
    } catch (error) {
      if (isPgError(error) && error.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException({
          statusCode: 409,
          message: 'Ya existe una referencia con ese código',
          errors: { code: 'Ya existe una referencia con ese código' },
        });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateLensDto): Promise<Lens> {
    const row = await this.db.one<LensRow>(
      `UPDATE lenses
       SET description = COALESCE($2, description),
           min_stock   = COALESCE($3, min_stock),
           updated_at  = now()
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, dto.description ?? null, dto.minStock ?? null],
    );
    if (!row) throw new NotFoundException('Referencia no encontrada');
    return toLens(row);
  }
}
