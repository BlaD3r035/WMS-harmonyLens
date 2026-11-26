import {
  Body,
  Controller,
  ConflictException,
  Get,
  Module,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import type { WarehouseLocation } from '@harmonylens/shared';
import { Roles } from '../auth/decorators.js';
import { optionalText, requiredText } from '../common/text.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DatabaseService } from '../db/database.service.js';
import { PG_UNIQUE_VIOLATION, isPgError } from '../db/pg-errors.js';

const createLocationSchema = z.object({
  code: requiredText('El código', 40),
  description: optionalText(200),
});
type CreateLocationDto = z.infer<typeof createLocationSchema>;

interface LocationRow {
  id: string;
  code: string;
  description: string | null;
}

@Controller('locations')
class LocationsController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @Roles('jefe_almacen', 'auxiliar_bodega', 'director_tecnico')
  list(): Promise<WarehouseLocation[]> {
    return this.db.query<LocationRow>(
      'SELECT id, code, description FROM warehouse_locations ORDER BY code',
    );
  }

  @Post()
  @Roles('jefe_almacen', 'auxiliar_bodega')
  async create(
    @Body(new ZodPipe(createLocationSchema)) dto: CreateLocationDto,
  ): Promise<WarehouseLocation> {
    try {
      const row = await this.db.one<LocationRow>(
        `INSERT INTO warehouse_locations (code, description)
         VALUES ($1, $2) RETURNING id, code, description`,
        [dto.code, dto.description],
      );
      return row!;
    } catch (error) {
      if (isPgError(error) && error.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException({
          statusCode: 409,
          message: 'Ya existe una ubicación con ese código',
          errors: { code: 'Ya existe una ubicación con ese código' },
        });
      }
      throw error;
    }
  }
}

@Module({ controllers: [LocationsController] })
export class LocationsModule {}
