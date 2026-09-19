import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PushProvider } from './push-provider';
import { PUSH_PROVIDER, type PushMessage } from './push-provider';

export const NotificationTypes = {
  USER_BLOCKED: 'USER_BLOCKED',
  USER_UNBLOCKED: 'USER_UNBLOCKED',
  MATCH_PARTNER_BLOCKED: 'MATCH_PARTNER_BLOCKED',
  NEW_MESSAGE: 'NEW_MESSAGE', // #7 chat push for offline recipients
  MATCH_REMINDER_60: 'MATCH_REMINDER_60', // #4 T-60min
  MATCH_REMINDER_15: 'MATCH_REMINDER_15', // #4 T-15min, data.action='en_route'
  PARTNER_EN_ROUTE: 'PARTNER_EN_ROUTE', // #4 "{name} вже в дорозі!"
  GOAL_CONFIRM_REQUEST: 'GOAL_CONFIRM_REQUEST', // #2 partner must confirm a joint goal
  GOAL_COMPLETED: 'GOAL_COMPLETED', // #2 "Ціль виконано! 🎉" to both partners
  REFERRAL_BONUS: 'REFERRAL_BONUS', // #9 "+N днів преміуму" to referee + referrer
  BADGE_AWARDED: 'BADGE_AWARDED', // #10 "Ви отримали досягнення: «…»"
  GROUP_INVITE: 'GROUP_INVITE', // #11 creator invited you to a group workout
  GROUP_RESPONSE: 'GROUP_RESPONSE', // #11 someone confirmed/declined your invite
  GROUP_REMINDER_T24: 'GROUP_REMINDER_T24', // #11 "X ще не підтвердив" 24h before
  TEST_PUSH: 'TEST_PUSH',
} as const;

/**
 * NotificationService facade (Part 0): the ONLY way feature code sends pushes.
 * Persists a Notification row per user regardless of delivery, so we keep an audit
 * trail and can replay/debug from the admin panel later.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
  ) {}

  async sendToUser(
    userId: string,
    type: string,
    message: PushMessage & { data?: Record<string, string> },
  ): Promise<void> {
    const devices = await this.prisma.deviceToken.findMany({ where: { userId } });
    let sent = false;
    if (devices.length > 0) {
      try {
        await this.pushProvider.send(
          devices.map((d) => d.token),
          message,
        );
        sent = true;
      } catch (error) {
        this.logger.error(`Push delivery failed for user ${userId} (${type})`, error);
      }
    } else {
      this.logger.debug(`No device tokens for user ${userId}; recording notification without delivery`);
    }

    await this.prisma.notification.create({
      data: {
        userId,
        type,
        payload: { title: message.title, body: message.body, data: message.data ?? {} },
        sentAt: sent ? new Date() : null,
      },
    });
  }

  async sendToUsers(userIds: string[], type: string, message: PushMessage): Promise<void> {
    await Promise.all(userIds.map((id) => this.sendToUser(id, type, message)));
  }
}
