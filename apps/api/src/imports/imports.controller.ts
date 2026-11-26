import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type {
  AuthUser,
  ImportDetail,
  ImportSummary,
} from '@harmonylens/shared';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { createImportSchema } from './import.schemas.js';
import type { CreateImportDto } from './import.schemas.js';
import { ImportsService } from './imports.service.js';

@Controller('imports')
@Roles('jefe_almacen', 'auxiliar_bodega')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get()
  list(): Promise<ImportSummary[]> {
    return this.imports.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ImportDetail> {
    return this.imports.get(id);
  }

  @Post()
  create(
    @Body(new ZodPipe(createImportSchema)) dto: CreateImportDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ImportDetail> {
    return this.imports.create(dto, user.id);
  }
}
