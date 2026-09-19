import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { GroupMatch, Match } from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  GROUP_REMINDER_HOURS_BEFORE,
  GROUP_REMINDER_JOB,
  type GroupReminderJobData,
  REMINDER_JOB,
  REMINDER_SLOTS_MINUTES,
  REMINDERS_QUEUE,
  type ReminderJobData,
  type ReminderSlot,
} from './reminders.constants';

type MatchRef = Pick<Match, 'id' | 'userAId' | 'userBId'>;

/**
 * Story #4 scheduler — Redis delayed jobs (BullMQ), one job per match × user × slot.
 *
 * Idempotency + no-orphans rule: syncForMatch() always REMOVES the 4 possible
 * reminder jobs before adding fresh ones, so repeated reschedules can never stack
 * duplicates, and ending a match (cancelForMatch) leaves nothing behind.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectQueue(REMINDERS_QUEUE) private readonly queue: Queue<ReminderJobData | GroupReminderJobData>,
    private readonly prisma: PrismaService,
  ) {}

  static jobId(matchId: string, userId: string, slot: ReminderSlot): string {
    // BullMQ forbids ':' in custom job IDs (it breaks the redis key layout).
    return `match.${matchId}.${userId}.${slot}`;
  }

  static groupJobId(groupId: string): string {
    return `group.${groupId}.t24`;
  }

  /** Full reconcile for a match: drop pending reminders, then (re)schedule from scheduled_at. */
  async syncForMatch(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return;

    await this.cancelForMatch(match);

    if (match.status !== 'ACTIVE' || !match.scheduledAt) return;
    const fireAt = match.scheduledAt.getTime();
    const now = Date.now();

    for (const userId of [match.userAId, match.userBId]) {
      for (const slot of REMINDER_SLOTS_MINUTES) {
        const delay = fireAt - slot * 60_000 - now;
        if (delay <= 0) continue; // slot already passed — never fire retroactively
        await this.queue.add(
          REMINDER_JOB,
          { matchId: match.id, userId, slot },
          { jobId: RemindersService.jobId(match.id, userId, slot), delay },
        );
      }
    }
    this.logger.debug(`Reminders synced for match ${match.id} (scheduledAt=${match.scheduledAt.toISOString()})`);
  }

  /** Invalidate every pending reminder of a match (reschedule / cancel / end). */
  async cancelForMatch(match: MatchRef): Promise<void> {
    for (const userId of [match.userAId, match.userBId]) {
      for (const slot of REMINDER_SLOTS_MINUTES) {
        const jobId = RemindersService.jobId(match.id, userId, slot);
        try {
          const job = await this.queue.getJob(jobId);
          await job?.remove();
        } catch (error) {
          // Job already firing/complete — the processor re-validates match state, so it no-ops.
          this.logger.debug(`Could not remove reminder job ${jobId}: ${(error as Error).message}`);
        }
      }
    }
  }

  /**
   * Schedule (or re-schedule) the T-24h creator reminder for a group. Re-running
   * this for the same group replaces the existing job — same idempotency contract
   * as syncForMatch. `scheduledAt` must be in the future; otherwise the job is
   * dropped (we never push retroactively).
   */
  async scheduleGroupReminder(group: Pick<GroupMatch, 'id' | 'creatorId' | 'scheduledAt'>): Promise<void> {
    await this.cancelGroupReminder(group.id);
    if (!group.scheduledAt) return;
    const delay = group.scheduledAt.getTime() - GROUP_REMINDER_HOURS_BEFORE * 3600_000 - Date.now();
    if (delay <= 0) return;
    await this.queue.add(
      GROUP_REMINDER_JOB,
      { groupId: group.id, creatorId: group.creatorId } satisfies GroupReminderJobData,
      { jobId: RemindersService.groupJobId(group.id), delay },
    );
  }

  /** Drop the T-24h reminder of a group (delete / reschedule / all-confirmed edge cases). */
  async cancelGroupReminder(groupId: string): Promise<void> {
    const jobId = RemindersService.groupJobId(groupId);
    try {
      const job = await this.queue.getJob(jobId);
      await job?.remove();
    } catch (error) {
      this.logger.debug(`Could not remove group reminder ${jobId}: ${(error as Error).message}`);
    }
  }
}
