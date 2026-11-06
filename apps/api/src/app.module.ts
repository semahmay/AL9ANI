import { Module, ValidationPipe, type Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { BusinessHoursModule } from './business-hours/business-hours.module';
import { CategoriesModule } from './categories/categories.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import configuration from './config/configuration';
import { EstablishmentsModule } from './establishments/establishments.module';
import { HealthModule } from './health/health.module';
import { ServicesModule } from './services/services.module';
import { UnavailablePeriodsModule } from './unavailable-periods/unavailable-periods.module';

const globalProviders: Provider[] = [
  {
    provide: APP_FILTER,
    useClass: AllExceptionsFilter,
  },
  {
    provide: APP_PIPE,
    useValue: new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
      validationError: {
        target: false,
        value: false,
      },
    }),
  },
  {
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
  },
  {
    provide: APP_GUARD,
    useClass: JwtAuthGuard,
  },
  {
    provide: APP_GUARD,
    useClass: RolesGuard,
  },
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // The repository uses one shared .env at its root. An optional local
      // apps/api/.env takes precedence when present.
      envFilePath: ['.env', '../../.env'],
      load: [configuration],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.getOrThrow<number>('authRateLimitTtlMs'),
            limit: configService.getOrThrow<number>('authRateLimitLimit'),
          },
        ],
        skipIf: () => configService.getOrThrow<boolean>('authRateLimitDisabled'),
      }),
    }),
    HealthModule,
    AuthModule,
    AdminModule,
    CategoriesModule,
    EstablishmentsModule,
    ServicesModule,
    BusinessHoursModule,
    UnavailablePeriodsModule,
  ],
  providers: globalProviders,
})
export class AppModule {}
