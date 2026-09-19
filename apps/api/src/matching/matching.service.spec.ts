import { MatchingService, toPreviewCard, toSearchCard } from './matching.service';
import type { User } from '@prisma/client';

describe('MatchingService (unit)', () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    matchRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    match: { findMany: jest.fn(), create: jest.fn() },
    rating: { groupBy: jest.fn() },
    notification: { create: jest.fn() },
  };
  const notifications = { sendToUser: jest.fn() };
  const service = new MatchingService(prisma as never, notifications as never);

  const user = {
    id: 'u1',
    email: 'secret@example.com',
    name: 'Олексій Коваль',
    role: 'USER' as const,
    status: 'ACTIVE' as const,
    level: 'BEGINNER' as const,
    goal: 'MASS' as const,
    schedule: 'вечір',
    gymId: null,
    photoUrl: null,
    bio: null,
    blockedReason: null,
    createdAt: new Date(),
  };

  beforeEach(() => jest.clearAllMocks());

  // ─── toPreviewCard / toSearchCard ─────────────────────────────────────────

  describe('toPreviewCard', () => {
    it('exposes only first name, level, goal, gym name and schedule', () => {
      const card = toPreviewCard({ ...user, gym: { name: 'SportLife Поділ' } } as User & { gym: { name: string } });
      expect(card).toEqual({
        firstName: 'Олексій',
        level: 'BEGINNER',
        goal: 'MASS',
        gymName: 'SportLife Поділ',
        schedule: 'вечір',
        ratingAverage: null,
        ratingCount: 0,
      });
      expect(JSON.stringify(card)).not.toContain('secret@example.com');
    });

    it('falls back to "Користувач" for blank name', () => {
      const card = toPreviewCard({ ...user, name: '  ', gym: null } as User & { gym: null });
      expect(card.firstName).toBe('Користувач');
      expect(card.gymName).toBeNull();
    });
  });

  describe('toSearchCard', () => {
    it('includes id, photoUrl and bio', () => {
      const u = { ...user, id: 'u2', name: 'Марія', photoUrl: 'https://x/photo.jpg', bio: 'Хочу партнера', gym: null } as User & { gym: null };
      const card = toSearchCard(u);
      expect(card.id).toBe('u2');
      expect(card.photoUrl).toBe('https://x/photo.jpg');
      expect(card.bio).toBe('Хочу партнера');
    });

    it('attaches rating aggregate when provided', () => {
      const card = toSearchCard(user as User & { gym: null }, { average: 4.7, count: 10 });
      expect(card.ratingAverage).toBe(4.7);
      expect(card.ratingCount).toBe(10);
    });
  });

  // ─── search ───────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('excludes the requesting user from results', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.matchRequest.findMany.mockResolvedValue([]);
      prisma.match.findMany.mockResolvedValue([]);
      prisma.rating.groupBy.mockResolvedValue([]);

      await service.search('u1', {});

      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where.id).toEqual({ not: 'u1' });
    });

    it('excludes users with pending/declined requests from this user', async () => {
      const users = [
        { ...user, id: 'u2', name: 'Юзер2', gym: null },
        { ...user, id: 'u3', name: 'Юзер3', gym: null },
      ];
      prisma.user.findMany.mockResolvedValue(users);
      prisma.matchRequest.findMany.mockResolvedValue([{ toUserId: 'u2' }]); // u2 already has a request
      prisma.match.findMany.mockResolvedValue([]);
      prisma.rating.groupBy.mockResolvedValue([]);

      const result = await service.search('u1', {});

      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].id).toBe('u3');
    });

    it('excludes already-matched (ACTIVE) users', async () => {
      const users = [{ ...user, id: 'u2', name: 'Юзер2', gym: null }];
      prisma.user.findMany.mockResolvedValue(users);
      prisma.matchRequest.findMany.mockResolvedValue([]);
      // u1 is already in an active match with u2
      prisma.match.findMany.mockResolvedValue([{ userAId: 'u1', userBId: 'u2' }]);
      prisma.rating.groupBy.mockResolvedValue([]);

      const result = await service.search('u1', {});

      expect(result.cards).toHaveLength(0);
    });

    it('applies filters to the where clause', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.matchRequest.findMany.mockResolvedValue([]);
      prisma.match.findMany.mockResolvedValue([]);
      prisma.rating.groupBy.mockResolvedValue([]);

      await service.search('u1', { level: 'INTERMEDIATE', goal: 'ENDURANCE' });

      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where.level).toBe('INTERMEDIATE');
      expect(where.goal).toBe('ENDURANCE');
    });
  });

  // ─── createRequest ────────────────────────────────────────────────────────

  describe('createRequest()', () => {
    it('throws ForbiddenException when requesting yourself', async () => {
      await expect(service.createRequest('u1', 'u1')).rejects.toThrow('Cannot send request to yourself');
    });

    it('throws ConflictException when a request already exists', async () => {
      prisma.matchRequest.findFirst.mockResolvedValue({ id: 'r1' });

      await expect(service.createRequest('u1', 'u2')).rejects.toThrow('Request already exists');
    });

    it('throws NotFoundException when the target user does not exist', async () => {
      prisma.matchRequest.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.createRequest('u1', 'u2')).rejects.toThrow('User not found');
    });

    it('throws ForbiddenException when the target user is not ACTIVE', async () => {
      prisma.matchRequest.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ ...user, status: 'SUSPENDED' });

      await expect(service.createRequest('u1', 'u2')).rejects.toThrow('User is not available');
    });

    it('creates a request and sends a push notification on success', async () => {
      prisma.matchRequest.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ ...user, id: 'u2', status: 'ACTIVE' });
      prisma.matchRequest.create.mockResolvedValue({ id: 'r1', fromUserId: 'u1', toUserId: 'u2', status: 'PENDING', createdAt: new Date() });

      const result = await service.createRequest('u1', 'u2');

      expect(result.id).toBe('r1');
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'u2',
        'MATCH_REQUEST',
        expect.objectContaining({ body: expect.stringContaining('хоче бути твоїм партнером') }),
      );
    });
  });

  // ─── respondToRequest ─────────────────────────────────────────────────────

  describe('respondToRequest()', () => {
    const request = { id: 'r1', fromUserId: 'u2', toUserId: 'u1', status: 'PENDING' };

    it('throws NotFoundException when the request does not exist', async () => {
      prisma.matchRequest.findUnique.mockResolvedValue(null);

      await expect(service.respondToRequest('r1', 'u1', true)).rejects.toThrow('Request not found');
    });

    it('throws ForbiddenException when a non-recipient tries to respond', async () => {
      prisma.matchRequest.findUnique.mockResolvedValue(request);

      await expect(service.respondToRequest('r1', 'u3', true)).rejects.toThrow('Only the recipient can respond');
    });

    it('throws ConflictException when the request is not PENDING', async () => {
      prisma.matchRequest.findUnique.mockResolvedValue({ ...request, status: 'ACCEPTED' });

      await expect(service.respondToRequest('r1', 'u1', true)).rejects.toThrow('Request is no longer pending');
    });

    it('declines: updates the request to DECLINED and returns', async () => {
      prisma.matchRequest.findUnique.mockResolvedValue(request);
      prisma.matchRequest.update.mockResolvedValue({ ...request, status: 'DECLINED' });

      const result = await service.respondToRequest('r1', 'u1', false);

      expect(result.status).toBe('DECLINED');
      expect(prisma.matchRequest.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'DECLINED' },
      });
      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('accepts: creates a match and notifies the sender', async () => {
      prisma.matchRequest.findUnique.mockResolvedValue(request);
      prisma.match.create.mockResolvedValue({ id: 'm1' });
      prisma.matchRequest.update.mockResolvedValue({ ...request, status: 'ACCEPTED' });

      const result = await service.respondToRequest('r1', 'u1', true);

      expect(result.status).toBe('ACCEPTED');
      expect(prisma.match.create).toHaveBeenCalled();
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'u2',
        'MATCH_ACCEPTED',
        expect.objectContaining({ body: expect.stringContaining('прийнято') }),
      );
    });
  });

  // ─── listIncomingRequests ─────────────────────────────────────────────────

  describe('listIncomingRequests()', () => {
    it('returns pending requests addressed to the user', async () => {
      const req = { id: 'r1', fromUserId: 'u2', toUserId: 'u1', status: 'PENDING', createdAt: new Date(), fromUser: { id: 'u2', name: 'Юзер', photoUrl: null, level: 'BEGINNER', goal: 'MASS', gym: { name: 'TestGym' } } };
      prisma.matchRequest.findMany.mockResolvedValue([req]);

      const result = await service.listIncomingRequests('u1');

      expect(result.requests).toHaveLength(1);
      expect(prisma.matchRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { toUserId: 'u1', status: 'PENDING' } }),
      );
    });
  });
});
