import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { EstablishmentsModule } from '../establishments/establishments.module';
import { UnavailablePeriodsController } from './unavailable-periods.controller';
import { UnavailablePeriodsService } from './unavailable-periods.service';

@Module({
  imports: [DatabaseModule, EstablishmentsModule],
  controllers: [UnavailablePeriodsController],
  providers: [UnavailablePeriodsService],
})
export class UnavailablePeriodsModule {}
