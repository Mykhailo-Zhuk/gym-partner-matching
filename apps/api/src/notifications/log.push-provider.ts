import { Injectable, Logger } from '@nestjs/common';
import type { PushMessage, PushProvider } from './push-provider';

/** Local/dev fallback: logs the push instead of delivering it. Always reports success. */
@Injectable()
export class LogPushProvider implements PushProvider {
  private readonly logger = new Logger('Push(log)');

  async send(deviceTokens: string[], message: PushMessage): Promise<{ delivered: number }> {
    this.logger.log(`push -> ${deviceTokens.length} device(s): "${message.title}" — ${message.body}`);
    return { delivered: deviceTokens.length };
  }
}
