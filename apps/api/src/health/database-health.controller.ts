import { Controller, Get, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';

export interface DatabaseHealthResponse {
  status: 'ok';
  database: 'connected';
  latencyMs: number;
  timestamp: string;
}

@Public()
@ApiTags('health')
@Controller('health')
export class DatabaseHealthController {
  private readonly logger = new Logger(DatabaseHealthController.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('database')
  @ApiOperation({ summary: 'Check that the database is reachable' })
  @ApiOkResponse({
    description: 'The database accepted a query.',
    schema: {
      example: {
        status: 'ok',
        database: 'connected',
        latencyMs: 4,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiServiceUnavailableResponse({ description: 'The database is not reachable.' })
  async check(): Promise<DatabaseHealthResponse> {
    const startedAt = Date.now();

    try {
      await this.prisma.checkConnection();

      return {
        status: 'ok',
        database: 'connected',
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Log the technical cause, but do not expose connection details to clients.
      this.logger.error(
        'Database readiness check failed',
        error instanceof Error ? error.stack : undefined,
      );

      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
