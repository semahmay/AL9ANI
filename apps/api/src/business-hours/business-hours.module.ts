import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { EstablishmentsModule } from '../establishments/establishments.module';
import { BusinessHoursController } from './business-hours.controller';
import { BusinessHoursService } from './business-hours.service';

@Module({
  imports: [DatabaseModule, EstablishmentsModule],
  controllers: [BusinessHoursController],
  providers: [BusinessHoursService],
})
export class BusinessHoursModule {}
