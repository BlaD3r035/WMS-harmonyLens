import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './db/database.module.js';
import { ImportsModule } from './imports/imports.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { LensesModule } from './lenses/lenses.module.js';
import { LocationsModule } from './locations/locations.module.js';
import { LotsModule } from './lots/lots.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    LensesModule,
    LocationsModule,
    ImportsModule,
    LotsModule,
    InventoryModule,
  ],
})
export class AppModule {}
