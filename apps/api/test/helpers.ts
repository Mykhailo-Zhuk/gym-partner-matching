import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

let cachedApp: INestApplication | undefined;

export async function createTestApp(): Promise<INestApplication> {
  if (cachedApp) return cachedApp;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  cachedApp = app;
  return app;
}

export async function closeTestApp() {
  await cachedApp?.close();
  cachedApp = undefined;
}
