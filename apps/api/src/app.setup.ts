import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

export interface AppSetupOptions {
  enableSwagger?: boolean;
}

export interface AppRuntimeSettings {
  appName: string;
  nodeEnv: string;
  port: number;
}

/**
 * Applies the HTTP-level setup shared by main.ts and the integration tests.
 * Global pipes, filters, and guards are registered in AppModule.
 */
export function configureApp(
  app: INestApplication,
  options: AppSetupOptions = {},
): AppRuntimeSettings {
  const config = app.get(ConfigService);
  const port = config.get<number>('port', 3001);
  const nodeEnv = config.get<string>('nodeEnv', 'development');
  const appName = config.get<string>('appName', 'Al9ani API');
  const corsOrigin = config.get<string>('corsOrigin', 'http://localhost:3000');

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  const swaggerEnabled = options.enableSwagger ?? (nodeEnv !== 'production' && nodeEnv !== 'test');

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(appName)
      .setDescription('API for the Al9ani booking platform.')
      .setVersion('0.1.0')
      .addServer(`http://localhost:${port}`, 'Local development')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Short-lived access token returned by login/register/refresh.',
      })
      .addCookieAuth(config.get<string>('refreshCookieName', 'al9ani_refresh'), {
        type: 'apiKey',
        in: 'cookie',
        description: 'HttpOnly refresh cookie used by web clients.',
      })
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  return { appName, nodeEnv, port };
}
