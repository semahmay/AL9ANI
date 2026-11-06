import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const { appName, nodeEnv, port } = configureApp(app);
  app.enableShutdownHooks();

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`${appName} is running at http://localhost:${port}/api`);

  if (nodeEnv !== 'production') {
    logger.log(`Swagger UI is available at http://localhost:${port}/docs`);
  }
}

void bootstrap();
