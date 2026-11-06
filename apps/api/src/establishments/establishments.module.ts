import { Module } from '@nestjs/common';

import { CategoriesModule } from '../categories/categories.module';
import { DatabaseModule } from '../database/database.module';
import { AdminEstablishmentsController } from './admin-establishments.controller';
import { EstablishmentsController } from './establishments.controller';
import { EstablishmentsService } from './establishments.service';
import { PublicEstablishmentsController } from './public-establishments.controller';

@Module({
  imports: [DatabaseModule, CategoriesModule],
  controllers: [
    EstablishmentsController,
    AdminEstablishmentsController,
    PublicEstablishmentsController,
  ],
  providers: [EstablishmentsService],
  exports: [EstablishmentsService],
})
export class EstablishmentsModule {}
