import { NotificationsService } from './notifications.service';

describe('NotificationsService (unit)', () => {
  const prisma = {
    deviceToken: { findMany: jest.fn() },
    notification: { create: jest.fn() },
  };
  const pushProvider = { send: jest.fn() };
  const service = new NotificationsService(prisma as never, pushProvider as never);

  beforeEach(() => {
    jest.clearAllMocks();
    pushProvider.send.mockResolvedValue(undefined);
  });

  describe('sendToUser', () => {
    it('records a notification even when the user has no device tokens', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([]);
      prisma.notification.create.mockResolvedValue({ id: 'n1' });

      await service.sendToUser('u1', 'TEST_PUSH', { title: 't', body: 'b' });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          type: 'TEST_PUSH',
          payload: { title: 't', body: 'b', data: {} },
          sentAt: null,
        },
      });
    });

    it('sends push to all device tokens and sets sentAt on success', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([{ token: 'tok1' }, { token: 'tok2' }]);
      prisma.notification.create.mockResolvedValue({ id: 'n1' });

      await service.sendToUser('u1', 'NEW_MESSAGE', { title: 'msg', body: 'hello' });

      expect(pushProvider.send).toHaveBeenCalledWith(['tok1', 'tok2'], { title: 'msg', body: 'hello' });
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sentAt: expect.any(Date) }) }),
      );
    });

    it('records notification with sentAt=null when push throws', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([{ token: 'tok1' }]);
      pushProvider.send.mockRejectedValue(new Error('FCM error'));
      prisma.notification.create.mockResolvedValue({ id: 'n1' });

      await service.sendToUser('u1', 'MATCH_REMINDER_60', { title: 't', body: 'b' });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sentAt: null }) }),
      );
    });

    it('forwards extra data fields in the payload', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([]);
      prisma.notification.create.mockResolvedValue({ id: 'n1' });

      await service.sendToUser('u1', 'BADGE_AWARDED', {
        title: '🏅',
        body: 'Badge earned',
        data: { slug: 'first_workout', deeplink: 'gymbros://profile/badges' },
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          type: 'BADGE_AWARDED',
          payload: {
            title: '🏅',
            body: 'Badge earned',
            data: { slug: 'first_workout', deeplink: 'gymbros://profile/badges' },
          },
          sentAt: null,
        },
      });
    });
  });

  describe('sendToUsers', () => {
    it('dispatches sendToUser to every id in the array', async () => {
      prisma.deviceToken.findMany.mockResolvedValue([]);
      prisma.notification.create.mockResolvedValue({ id: 'n1' });

      await service.sendToUsers(['u1', 'u2'], 'GROUP_INVITE', { title: 't', body: 'b' });

      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });
  });
});
