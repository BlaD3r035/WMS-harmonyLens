import { Module } from '@nestjs/common';
import { LensesController } from './lenses.controller.js';
import { LensesService } from './lenses.service.js';

@Module({
  controllers: [LensesController],
  providers: [LensesService],
})
export class LensesModule {}
