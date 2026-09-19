import { Injectable, Logger } from '@nestjs/common';
import { getFirebaseMessaging } from './firebase';
import type { PushMessage, PushProvider } from './push-provider';

@Injectable()
export class FcmPushProvider implements PushProvider {
  private readonly logger = new Logger(FcmPushProvider.name);

  async send(deviceTokens: string[], message: PushMessage): Promise<{ delivered: number }> {
    if (deviceTokens.length === 0) return { delivered: 0 };
    const res = await getFirebaseMessaging().sendEachForMulticast({
      tokens: deviceTokens,
      notification: { title: message.title, body: message.body },
      data: message.data,
    });
    this.logger.debug(`FCM multicast: ${res.successCount}/${deviceTokens.length} delivered`);
    return { delivered: res.successCount };
  }
}
