import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser, Lot } from '@harmonylens/shared';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import {
  assignLocationSchema,
  lotQuerySchema,
  rejectLotSchema,
} from './lot.schemas.js';
import type { LotQuery, RejectLotDto } from './lot.schemas.js';
import { LotsService } from './lots.service.js';

@Controller('lots')
export class LotsController {
  constructor(private readonly lots: LotsService) {}

  /** HU06.1 (status=pendiente_revision) and HU11.1 (inventory by lot). */
  @Get()
  @Roles('jefe_almacen', 'auxiliar_bodega', 'director_tecnico')
  list(@Query(new ZodPipe(lotQuerySchema)) query: LotQuery): Promise<Lot[]> {
    return this.lots.list(query);
  }

  /** HU06.2 */
  @Post(':id/approve')
  @HttpCode(200)
  @Roles('director_tecnico')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Lot> {
    return this.lots.approve(id, user.id);
  }

  /** HU06.3: the reason is mandatory. */
  @Post(':id/reject')
  @HttpCode(200)
  @Roles('director_tecnico')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(rejectLotSchema)) dto: RejectLotDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Lot> {
    return this.lots.reject(id, user.id, dto.reason);
  }

  @Patch(':id/location')
  @Roles('jefe_almacen', 'auxiliar_bodega')
  assignLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(assignLocationSchema)) dto: { locationId: string },
    @CurrentUser() user: AuthUser,
  ): Promise<Lot> {
    return this.lots.assignLocation(id, dto.locationId, user.id);
  }
}
