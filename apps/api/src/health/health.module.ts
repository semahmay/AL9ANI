import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { DatabaseHealthController } from './database-health.controller';
import { HealthController } from './health.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, DatabaseHealthController],
})
export class HealthModule {}
