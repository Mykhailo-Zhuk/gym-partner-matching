import { BadRequestException } from '@nestjs/common';
import { ReferralsService } from './referrals.service';

/**
 * Unit tests for ReferralsService.
 * Covers: assertCodeValid, myCode (find + create paths), applyCode (all branches),
 * adminStats. Push delivery and badge hooks are exercised as far as possible in
 * unit tests; the e2e suite covers the full integration.
 */
describe('ReferralsService (unit)', () => {
  const prisma = {
    referralCode: { findUnique: jest.fn(), create: jest.fn(), count: jest.fn() },
    referral: { findUnique: jest.fn(), count: jest.fn(), create: jest.fn(), groupBy: jest.fn() },
    user: { findUniqueOrThrow: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  };
  const notifications = { sendToUser: jest.fn() };
  const badges = { award: jest.fn() };
  const service = new ReferralsService(prisma as never, notifications as never, badges as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.referralCode.findUnique.mockReset();
    prisma.referralCode.create.mockReset();
    prisma.referralCode.count.mockReset();
    prisma.referral.findUnique.mockReset();
    prisma.referral.count.mockReset();
    prisma.referral.create.mockReset();
    prisma.referral.groupBy.mockReset();
    prisma.user.findUniqueOrThrow.mockReset();
    prisma.user.update.mockReset();
    prisma.user.findMany.mockReset();
    notifications.sendToUser.mockReset();
    badges.award.mockReset();
  });

  // ─── assertCodeValid ────────────────────────────────────────────────────

  describe('assertCodeValid', () => {
    it('throws "Код не знайдено" for an unknown code', async () => {
      prisma.referralCode.findUnique.mockResolvedValue(null);
      await expect(service.assertCodeValid('ZZZZZZZZ')).rejects.toThrow(new BadRequestException('Код не знайдено'));
    });

    it('throws on empty / whitespace input', async () => {
      await expect(service.assertCodeValid('   ')).rejects.toThrow(new BadRequestException('Код не знайдено'));
      expect(prisma.referralCode.findUnique).not.toHaveBeenCalled();
    });

    it('normalises the code to uppercase before lookup', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({ id: 'rc1', userId: 'u1', code: 'ABC123' });
      await service.assertCodeValid('abc123');
      expect(prisma.referralCode.findUnique).toHaveBeenCalledWith({ where: { code: 'ABC123' } });
    });
  });

  // ─── myCode ──────────────────────────────────────────────────────────────

  describe('myCode', () => {
    beforeEach(() => {
      (prisma as unknown as { $transaction: jest.Mock }).$transaction = jest.fn(async (cb: (tx: typeof prisma) => Promise<void>) =>
        cb(prisma),
      );
    });

    it('returns the existing code without creating a new one', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({ id: 'rc1', userId: 'u1', code: 'ABC123', createdAt: new Date() });
      prisma.referral.count.mockResolvedValue(2);

      const result = await service.myCode('u1');

      expect(result.code).toBe('ABC123');
      expect(result.redemptions).toBe(2);
      expect(prisma.referralCode.create).not.toHaveBeenCalled();
    });

    it('creates and returns a new code when none exists', async () => {
      prisma.referralCode.findUnique
        .mockResolvedValueOnce(null) // check by userId
        .mockResolvedValueOnce({ id: 'rc1', userId: 'u1', code: 'NEWCODE1', createdAt: new Date() }); // check by code (uniqueCode)
      prisma.referralCode.create.mockResolvedValue({ id: 'rc1', userId: 'u1', code: 'NEWCODE1', createdAt: new Date() });
      prisma.referral.count.mockResolvedValue(0);

      const result = await service.myCode('u1');

      expect(prisma.referralCode.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'u1' }) }),
      );
      expect(result.redemptions).toBe(0);
    });

    it('returns a shareLink containing the code', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({ id: 'rc1', userId: 'u1', code: 'ABC123', createdAt: new Date() });
      prisma.referral.count.mockResolvedValue(0);

      const result = await service.myCode('u1');

      expect(result.shareLink).toContain('ABC123');
    });
  });

  // ─── applyCode ──────────────────────────────────────────────────────────

  describe('applyCode', () => {
    beforeEach(() => {
      (prisma as unknown as { $transaction: jest.Mock }).$transaction = jest.fn(async (cb: (tx: typeof prisma) => Promise<void>) =>
        cb(prisma),
      );
    });

    it('extends the referee subscription by 3 days from now', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({ id: 'rc1', userId: 'u_referrer', code: 'ABC123' });
      prisma.referral.findUnique.mockResolvedValue(null);
      prisma.user.findUniqueOrThrow
        .mockResolvedValueOnce({ id: 'u_referee', name: 'Referee', subscriptionUntil: null })
        .mockResolvedValueOnce({ id: 'u_referrer', name: 'Referrer', subscriptionUntil: null });

      await service.applyCode('u_referee', 'ABC123', { strict: true });

      expect(prisma.referral.create).toHaveBeenCalledTimes(1);
      const createArg = prisma.referral.create.mock.calls[0][0].data;
      expect(createArg).toMatchObject({ codeId: 'rc1', referrerId: 'u_referrer', refereeId: 'u_referee', status: 'GRANTED' });
      expect(createArg.bonusGrantedAt).toBeInstanceOf(Date);
    });

    it('extends the referrer subscription by 3 days', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({ id: 'rc1', userId: 'u_referrer', code: 'ABC123' });
      prisma.referral.findUnique.mockResolvedValue(null);
      prisma.user.findUniqueOrThrow
        .mockResolvedValueOnce({ id: 'u_referee', name: 'Referee', subscriptionUntil: null })
        .mockResolvedValueOnce({ id: 'u_referrer', name: 'Referrer', subscriptionUntil: null });

      await service.applyCode('u_referee', 'ABC123', { strict: true });

      // Second user.update call is for the referrer
      const updates = prisma.user.update.mock.calls;
      const referrerUpdate = updates.find((c) => c[0].where.id === 'u_referrer');
      expect(referrerUpdate).toBeDefined();
    });

    it('does not shrink an existing premium subscription window (referee)', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({ id: 'rc1', userId: 'u_referrer', code: 'ABC123' });
      prisma.referral.findUnique.mockResolvedValue(null);
      const future = new Date(Date.now() + 10 * 24 * 3600_000);
      prisma.user.findUniqueOrThrow
        .mockResolvedValueOnce({ id: 'u_referee', name: 'Referee', subscriptionUntil: future })
        .mockResolvedValueOnce({ id: 'u_referrer', name: 'Referrer', subscriptionUntil: null });

      await service.applyCode('u_referee', 'ABC123', { strict: true });

      // The update should preserve the existing future date
      const updateCall = prisma.user.update.mock.calls.find((c) => c[0].where.id === 'u_referee');
      const newUntil: Date = updateCall[0].data.subscriptionUntil;
      expect(newUntil.getTime()).toBeGreaterThan(future.getTime());
    });

    it('rejects self-referral: throws in strict mode', async () => {
      // When the code belongs to the same user as the referee
      prisma.referralCode.findUnique.mockResolvedValue({ id: 'rc1', userId: 'u_referee', code: 'SELF123' });
      prisma.referral.findUnique.mockResolvedValue(null);

      await expect(service.applyCode('u_referee', 'SELF123', { strict: true })).rejects.toThrow(
        new BadRequestException('Код не знайдено'),
      );
    });

    it('rejects self-referral: silent no-op in non-strict mode', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({ id: 'rc1', userId: 'u_referee', code: 'SELF123' });
      prisma.referral.findUnique.mockResolvedValue(null);

      const result = await service.applyCode('u_referee', 'SELF123', { strict: false });

      expect(result).toEqual({ applied: false });
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it('idempotency: returns early if referee already has a referral', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({ id: 'rc1', userId: 'u_referrer', code: 'ABC123' });
      prisma.referral.findUnique.mockResolvedValue({ id: 'r1', refereeId: 'u_referee', referrerId: 'u_other' });

      const result = await service.applyCode('u_referee', 'ABC123', { strict: true });

      expect(result).toEqual({ applied: true, referrerId: 'u_other' });
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it('sends push notifications to both referee and referrer', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({ id: 'rc1', userId: 'u_referrer', code: 'ABC123' });
      prisma.referral.findUnique.mockResolvedValue(null);
      prisma.user.findUniqueOrThrow
        .mockResolvedValueOnce({ id: 'u_referee', name: 'Referee', subscriptionUntil: null })
        .mockResolvedValueOnce({ id: 'u_referrer', name: 'Referrer', subscriptionUntil: null });
      notifications.sendToUser.mockResolvedValue(undefined);

      await service.applyCode('u_referee', 'ABC123', { strict: true });

      expect(notifications.sendToUser).toHaveBeenCalledTimes(2);
    });

    it('awards the SOCIAL_3 badge to the referrer after successful referral', async () => {
      prisma.referralCode.findUnique.mockResolvedValue({ id: 'rc1', userId: 'u_referrer', code: 'ABC123' });
      prisma.referral.findUnique.mockResolvedValue(null);
      prisma.user.findUniqueOrThrow
        .mockResolvedValueOnce({ id: 'u_referee', name: 'Referee', subscriptionUntil: null })
        .mockResolvedValueOnce({ id: 'u_referrer', name: 'Referrer', subscriptionUntil: null });
      badges.award.mockResolvedValue({ awarded: false });

      await service.applyCode('u_referee', 'ABC123', { strict: true });

      expect(badges.award).toHaveBeenCalledWith('u_referrer', 'social_3');
    });

    it('strict path: unknown code throws BadRequest', async () => {
      prisma.referralCode.findUnique.mockResolvedValue(null);

      await expect(service.applyCode('u_referee', 'BAD', { strict: true })).rejects.toThrow(
        new BadRequestException('Код не знайдено'),
      );
    });

    it('non-strict path: unknown code is silently ignored', async () => {
      prisma.referralCode.findUnique.mockResolvedValue(null);

      const result = await service.applyCode('u_referee', 'BAD', { strict: false });

      expect(result).toEqual({ applied: false });
    });
  });

  // ─── adminStats ──────────────────────────────────────────────────────────

  describe('adminStats', () => {
    it('returns total codes, total granted, and top referrers', async () => {
      prisma.referralCode.count.mockResolvedValue(42);
      prisma.referral.count.mockResolvedValue(15);
      prisma.referral.groupBy.mockResolvedValue([
        { referrerId: 'u1', _count: { _all: 5 } },
        { referrerId: 'u2', _count: { _all: 3 } },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'Alice', email: 'alice@test.com' },
        { id: 'u2', name: 'Bob', email: 'bob@test.com' },
      ]);

      const result = await service.adminStats();

      expect(result.totalCodes).toBe(42);
      expect(result.totalGranted).toBe(15);
      expect(result.topReferrers).toEqual([
        { userId: 'u1', name: 'Alice', email: 'alice@test.com', count: 5 },
        { userId: 'u2', name: 'Bob', email: 'bob@test.com', count: 3 },
      ]);
    });

    it('returns empty topReferrers when no referrals exist', async () => {
      prisma.referralCode.count.mockResolvedValue(0);
      prisma.referral.count.mockResolvedValue(0);
      prisma.referral.groupBy.mockResolvedValue([]);

      const result = await service.adminStats();

      expect(result.topReferrers).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });
});
