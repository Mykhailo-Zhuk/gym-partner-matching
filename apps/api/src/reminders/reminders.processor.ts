import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { firstName } from '../chat/chat.service';
import { NotificationTypes, NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  GROUP_REMINDER_JOB,
  type GroupReminderJobData,
  REMINDERS_QUEUE,
  type ReminderJobData,
} from './reminders.constants';

/**
 * Fires the T-60 / T-15 pushes (story #4). Both deep-link into the match chat;
 * the T-15 push carries action=en_route so the app can offer the "Я в дорозі"
 * button straight from the notification.
 *
 * Stale-job guard: the job is re-checked against current match state, so a
 * reminder queued before a cancel/reschedule can never push after the fact.
 */
@Processor(REMINDERS_QUEUE)
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<ReminderJobData | GroupReminderJobData>): Promise<void> {
    if (job.name === GROUP_REMINDER_JOB) {
      return this.processGroupReminder(job as Job<GroupReminderJobData>);
    }
    return this.processMatchReminder(job as Job<ReminderJobData>);
  }

  private async processMatchReminder(job: Job<ReminderJobData>): Promise<void> {
    const { matchId, userId, slot } = job.data;
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        userA: { select: { id: true, name: true, status: true } },
        userB: { select: { id: true, name: true, status: true } },
      },
    });
    if (!match || match.status !== 'ACTIVE' || !match.scheduledAt) return; // cancelled/ended/rescheduled
    if (match.scheduledAt.getTime() <= Date.now()) return; // match already over — no retroactive pushes

    const me = match.userAId === userId ? match.userA : match.userB;
    const partner = match.userAId === userId ? match.userB : match.userA;
    if (!me || !partner || partner.status !== 'ACTIVE') return;

    const deeplink = `gymbros://matches/${matchId}/chat`;
    if (slot === 60) {
      await this.notifications.sendToUser(userId, NotificationTypes.MATCH_REMINDER_60, {
        title: 'GymBrosUK',
        body: `Не забудь! Через годину тренування з ${firstName(partner.name)}`,
        data: { matchId, deeplink },
      });
    } else {
      await this.notifications.sendToUser(userId, NotificationTypes.MATCH_REMINDER_15, {
        title: 'GymBrosUK',
        body: 'Тренування за 15 хвилин! Готовий?',
        data: { matchId, deeplink, action: 'en_route' },
      });
    }
    this.logger.debug(`Reminder slot=${slot} sent to user ${userId} for match ${matchId}`);
  }

  /**
   * Group T-24h reminder (story #11): if any invited member still hasn't
   * confirmed, push the creator so they can chase. Re-checks state at fire
   * time so a late confirm cancels the push without us needing a cancel hook.
   */
  private async processGroupReminder(job: Job<GroupReminderJobData>): Promise<void> {
    const { groupId, creatorId } = job.data;
    const group = await this.prisma.groupMatch.findUnique({
      where: { id: groupId },
      include: { members: { select: { status: true, userId: true, user: { select: { name: true, status: true } } } } },
    });
    if (!group || !group.scheduledAt) return;
    if (group.scheduledAt.getTime() <= Date.now()) return; // already over

    const unconfirmed = group.members.filter((m) => m.status === 'INVITED' && m.user.status === 'ACTIVE');
    if (unconfirmed.length === 0) return; // everyone already responded

    const names = unconfirmed.map((m) => firstName(m.user.name)).join(', ');
    await this.notifications.sendToUser(creatorId, NotificationTypes.GROUP_REMINDER_T24, {
      title: 'GymBrosUK',
      body: `Група «${group.title}»: ${names} ще не підтвердили`,
      data: { groupId, deeplink: `gymbros://groups/${groupId}` },
    });
    this.logger.debug(`Group T-24h reminder sent to creator ${creatorId} for group ${groupId} (${unconfirmed.length} unconfirmed)`);
  }
}
