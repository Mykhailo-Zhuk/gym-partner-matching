import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1); // behind reverse proxy in staging/prod; gives real client IPs
  app.enableCors({ origin: true }); // tightened at the edge in prod; admin/mobile use own hosts
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // OpenAPI spec — cross-cutting rule #1: every endpoint ships with a spec.
  const config = new DocumentBuilder()
    .setTitle('GymBrosUK API')
    .setDescription(
      'GymBrosUK API — Parts 0–4: foundation, onboarding+admin, chat (#7) + push reminders (#4), dashboard (#2) + ratings (#5)',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
   
  console.log(`API listening on http://localhost:${port} (docs: /docs)`);
}

void bootstrap();
