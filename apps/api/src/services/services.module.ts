import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { EstablishmentsModule } from '../establishments/establishments.module';
import { PublicServicesController } from './public-services.controller';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [DatabaseModule, EstablishmentsModule],
  controllers: [ServicesController, PublicServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
