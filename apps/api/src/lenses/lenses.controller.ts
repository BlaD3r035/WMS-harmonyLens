import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Lens } from '@harmonylens/shared';
import { Roles } from '../auth/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import {
  createLensSchema,
  lensQuerySchema,
  updateLensSchema,
} from './lens.schemas.js';
import type { CreateLensDto, UpdateLensDto } from './lens.schemas.js';
import { LensesService } from './lenses.service.js';

@Controller('lenses')
export class LensesController {
  constructor(private readonly lenses: LensesService) {}

  @Get()
  @Roles(
    'jefe_almacen',
    'auxiliar_bodega',
    'director_tecnico',
    'admin_puntos_venta',
  )
  list(
    @Query(new ZodPipe(lensQuerySchema)) query: { q?: string },
  ): Promise<Lens[]> {
    return this.lenses.list(query.q);
  }

  @Post()
  @Roles('jefe_almacen')
  create(
    @Body(new ZodPipe(createLensSchema)) dto: CreateLensDto,
  ): Promise<Lens> {
    return this.lenses.create(dto);
  }

  @Patch(':id')
  @Roles('jefe_almacen')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateLensSchema)) dto: UpdateLensDto,
  ): Promise<Lens> {
    return this.lenses.update(id, dto);
  }
}
