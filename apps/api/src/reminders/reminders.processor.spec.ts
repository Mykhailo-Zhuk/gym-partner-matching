import type { Job } from 'bullmq';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ReminderJobData } from './reminders.constants';
import { RemindersProcessor } from './reminders.processor';

const FUTURE = () => new Date(Date.now() + 45 * 60_000);

const makeMatch = (overrides: object = {}) => ({
  id: 'm1',
  userAId: 'u1',
  userBId: 'u2',
  status: 'ACTIVE',
  scheduledAt: FUTURE(),
  userA: { id: 'u1', name: 'Дмитро Савченко', status: 'ACTIVE' },
  userB: { id: 'u2', name: 'Олексій Коваль', status: 'ACTIVE' },
  ...overrides,
});

const job = (data: Partial<ReminderJobData>) =>
  ({ data: { matchId: 'm1', userId: 'u1', slot: 60, ...data } }) as Job<ReminderJobData>;

describe('RemindersProcessor (unit)', () => {
  const prisma = { match: { findUnique: jest.fn() } };
  const notifications = { sendToUser: jest.fn() };
  const processor = new RemindersProcessor(
    prisma as unknown as PrismaService,
    notifications as unknown as NotificationsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.match.findUnique.mockResolvedValue(makeMatch());
  });

  it('T-60: "Не забудь! Через годину тренування з {partner}" with chat deep-link', async () => {
    await processor.process(job({ slot: 60 }));

    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'u1',
      'MATCH_REMINDER_60',
      expect.objectContaining({
        body: 'Не забудь! Через годину тренування з Олексій',
        data: { matchId: 'm1', deeplink: 'gymbros://matches/m1/chat' },
      }),
    );
  });

  it('T-15: "Тренування за 15 хвилин! Готовий?" with the en_route action', async () => {
    await processor.process(job({ slot: 15 }));

    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'u1',
      'MATCH_REMINDER_15',
      expect.objectContaining({
        body: 'Тренування за 15 хвилин! Готовий?',
        data: expect.objectContaining({ action: 'en_route', deeplink: 'gymbros://matches/m1/chat' }),
      }),
    );
  });

  it.each([
    ['ended match', makeMatch({ status: 'ENDED' })],
    ['cleared schedule', makeMatch({ scheduledAt: null })],
    ['past match', makeMatch({ scheduledAt: new Date(Date.now() - 1000) })],
    ['missing match', null],
  ])('stale job no-op: %s', async (_label, match) => {
    prisma.match.findUnique.mockResolvedValue(match);
    await processor.process(job({ slot: 60 }));
    expect(notifications.sendToUser).not.toHaveBeenCalled();
  });

  it('does not remind when the partner was blocked meanwhile', async () => {
    prisma.match.findUnique.mockResolvedValue(makeMatch({ userB: { id: 'u2', name: 'Олексій', status: 'BLOCKED' } }));
    await processor.process(job({ slot: 60 }));
    expect(notifications.sendToUser).not.toHaveBeenCalled();
  });
});
