import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { type GroupReminderJobData, REMINDER_JOB, type ReminderJobData } from './reminders.constants';
import { RemindersService } from './reminders.service';

const MATCH = { id: 'm1', userAId: 'u1', userBId: 'u2', status: 'ACTIVE' as const };

describe('RemindersService (unit)', () => {
  const queue = {
    add: jest.fn<Promise<unknown>, [string, ReminderJobData | GroupReminderJobData, object]>(),
    getJob: jest.fn(),
  };
  const prisma = { match: { findUnique: jest.fn() } };
  const service = new RemindersService(
    queue as unknown as Queue<ReminderJobData | GroupReminderJobData>,
    prisma as unknown as PrismaService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('schedules 4 delayed jobs (2 users × 2 slots) when all slots are in the future', async () => {
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60_000); // +2h
    prisma.match.findUnique.mockResolvedValue({ ...MATCH, scheduledAt });

    await service.syncForMatch('m1');

    expect(queue.add).toHaveBeenCalledTimes(4);
    const byKey = new Map(
      queue.add.mock.calls.map(([, data, opts]) => [
        `${(data as ReminderJobData).userId}:${(data as ReminderJobData).slot}`,
        (opts as { jobId: string; delay: number }).delay,
      ]),
    );
    // T-60 fires ~1h from now, T-15 ~1h45 from now (±5s for test runtime)
    expect(byKey.get('u1:60')).toBeGreaterThan(55 * 60_000 - 5000);
    expect(byKey.get('u1:15')).toBeGreaterThan(100 * 60_000 - 5000);
    expect(byKey.get('u2:60')).toBeGreaterThan(55 * 60_000 - 5000);
    expect(byKey.get('u1:60')).toBeLessThan(byKey.get('u1:15')!);
    // deterministic ids = at most one reminder per slot per user
    expect(queue.add).toHaveBeenCalledWith(
      REMINDER_JOB,
      { matchId: 'm1', userId: 'u1', slot: 60 },
      expect.objectContaining({ jobId: 'match.m1.u1.60' }),
    );
  });

  it('never fires retroactively: past slots are skipped', async () => {
    const scheduledAt = new Date(Date.now() + 30 * 60_000); // +30min => T-60 already gone
    prisma.match.findUnique.mockResolvedValue({ ...MATCH, scheduledAt });

    await service.syncForMatch('m1');

    expect(queue.add).toHaveBeenCalledTimes(2); // only slot 15 for both users
    expect(queue.add.mock.calls.every(([, d]) => (d as ReminderJobData).slot === 15)).toBe(true);
  });

  it('idempotency: every sync removes the existing jobs before adding (repeated reschedules never stack)', async () => {
    const remove = jest.fn();
    queue.getJob.mockResolvedValue({ remove });
    prisma.match.findUnique.mockResolvedValue({ ...MATCH, scheduledAt: new Date(Date.now() + 2 * 60 * 60_000) });

    await service.syncForMatch('m1');
    await service.syncForMatch('m1');

    expect(queue.getJob).toHaveBeenCalledTimes(8); // 4 job ids × 2 syncs
    expect(remove).toHaveBeenCalledTimes(8);
    expect(queue.add).toHaveBeenCalledTimes(8); // exactly 4 live jobs after each sync
  });

  it('cancel/invalidation: ENDED match or cleared scheduled_at => zero jobs added, old ones removed', async () => {
    const remove = jest.fn();
    queue.getJob.mockResolvedValue({ remove });
    prisma.match.findUnique.mockResolvedValue({ ...MATCH, status: 'ENDED', scheduledAt: new Date(Date.now() + 2e6) });

    await service.syncForMatch('m1');

    expect(queue.add).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(4);
  });

  it('cancelForMatch removes all 4 possible jobs', async () => {
    const remove = jest.fn();
    queue.getJob.mockResolvedValue({ remove });

    await service.cancelForMatch(MATCH);

    expect(['match.m1.u1.60', 'match.m1.u1.15', 'match.m1.u2.60', 'match.m1.u2.15']).toEqual(
      expect.arrayContaining(queue.getJob.mock.calls.map(([id]) => id)),
    );
    expect(remove).toHaveBeenCalledTimes(4);
  });
});
