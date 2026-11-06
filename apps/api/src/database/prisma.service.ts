import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(ConfigService) configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('databaseUrl');

    // Prisma connects lazily on the first query, so the API can still start and
    // serve the liveness endpoint while PostgreSQL is temporarily unavailable.
    super({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  /**
   * Lightweight readiness probe used by GET /api/health/database.
   */
  async checkConnection(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma client disconnected');
  }
}
