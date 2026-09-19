import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { AdminService } from './admin.service';

describe('AdminService (unit)', () => {
  const tx = {
    user: { update: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    match: { findMany: jest.fn() },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  const notifications = { sendToUser: jest.fn(), sendToUsers: jest.fn() };
  const audit = { log: jest.fn() };
  const auth = { revokeAllUserTokens: jest.fn() };
  const chatGateway = { disconnectUser: jest.fn() };

  const service = new AdminService(
    prisma as unknown as PrismaService,
    notifications as unknown as NotificationsService,
    audit as unknown as AuditService,
    auth as unknown as AuthService,
    chatGateway as unknown as ChatGateway,
  );

  beforeEach(() => jest.clearAllMocks());

  describe('blockUser', () => {
    it('blocks, revokes sessions, notifies user + active match partners, audits', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'USER', status: 'ACTIVE' });
      prisma.match.findMany.mockResolvedValue([
        { userAId: 'u1', userBId: 'p1' },
        { userAId: 'p2', userBId: 'u1' },
      ]);

      const result = await service.blockUser('u1', 'Причина', 'admin-1');

      expect(result).toEqual({ id: 'u1', status: 'BLOCKED', notifiedMatchPartners: 2 });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { status: 'BLOCKED', blockedReason: 'Причина' },
      });
      expect(tx.refreshToken.updateMany).toHaveBeenCalled(); // instant access revocation
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ actorId: 'admin-1', action: 'BLOCK_USER', targetId: 'u1' }),
        }),
      );
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'u1',
        'USER_BLOCKED',
        expect.objectContaining({ body: 'Обліковий запис заблоковано' }),
      );
      expect(notifications.sendToUsers).toHaveBeenCalledWith(
        ['p1', 'p2'],
        'MATCH_PARTNER_BLOCKED',
        expect.objectContaining({ body: 'Користувача заблоковано адміністрацією' }),
      );
      expect(chatGateway.disconnectUser).toHaveBeenCalledWith('u1'); // chat access ends immediately
    });

    it('refuses to block an admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'a', role: 'ADMIN', status: 'ACTIVE' });
      await expect(service.blockUser('a', 'x', 'admin-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses a double block', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'USER', status: 'BLOCKED' });
      await expect(service.blockUser('u1', 'x', 'admin-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('404s on unknown users', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.blockUser('nope', 'x', 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('unblockUser', () => {
    it('restores access, notifies the user, audits', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'USER', status: 'BLOCKED' });
      const result = await service.unblockUser('u1', 'admin-1');
      expect(result).toEqual({ id: 'u1', status: 'ACTIVE' });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { status: 'ACTIVE', blockedReason: null },
      });
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'u1',
        'USER_UNBLOCKED',
        expect.objectContaining({ body: 'Ваш акаунт розблоковано' }),
      );
    });
  });
});
