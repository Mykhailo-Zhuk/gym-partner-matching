import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { ConnectionOptions } from 'bullmq';
import { REMINDERS_QUEUE } from './reminders.constants';
import { RemindersProcessor } from './reminders.processor';
import { RemindersService } from './reminders.service';

/** BullMQ connection from REDIS_URL (redis://[:pass@]host:port[/db]). */
export function redisConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6380');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.pathname && url.pathname !== '/' ? { db: Number(url.pathname.slice(1)) } : {}),
  };
}

@Module({
  imports: [BullModule.registerQueue({ name: REMINDERS_QUEUE })],
  providers: [RemindersService, RemindersProcessor],
  exports: [RemindersService],
})
export class RemindersModule {}

/** Registers the shared BullMQ connection once. Imported by AppModule only. */
@Module({
  imports: [BullModule.forRoot({ connection: redisConnection() })],
  exports: [BullModule],
})
export class BullRootModule {}
