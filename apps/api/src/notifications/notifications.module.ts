import { Global, Module } from '@nestjs/common';
import { FcmPushProvider } from './fcm.push-provider';
import { isFirebaseConfigured } from './firebase';
import { LogPushProvider } from './log.push-provider';
import { NotificationsService } from './notifications.service';
import { PUSH_PROVIDER, type PushProvider } from './push-provider';

@Global()
@Module({
  providers: [
    NotificationsService,
    {
      provide: PUSH_PROVIDER,
      useFactory: (): PushProvider => (isFirebaseConfigured() ? new FcmPushProvider() : new LogPushProvider()),
    },
  ],
  exports: [NotificationsService, PUSH_PROVIDER],
})
export class NotificationsModule {}
