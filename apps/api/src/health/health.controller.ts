import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';

const API_VERSION = '0.1.0';

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptime: number;
}

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Check that the API process is running' })
  @ApiOkResponse({
    description: 'The API is healthy.',
    schema: {
      example: {
        status: 'ok',
        service: 'Al9ani API',
        version: API_VERSION,
        environment: 'development',
        timestamp: '2026-01-01T00:00:00.000Z',
        uptime: 12.34,
      },
    },
  })
  check(): HealthResponse {
    return {
      status: 'ok',
      service: this.configService.get<string>('appName', 'Al9ani API'),
      version: API_VERSION,
      environment: this.configService.get<string>('nodeEnv', 'development'),
      timestamp: new Date().toISOString(),
      uptime: Number(process.uptime().toFixed(3)),
    };
  }
}
