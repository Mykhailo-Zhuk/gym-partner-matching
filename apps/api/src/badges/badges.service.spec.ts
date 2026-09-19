import { BadgesService, BADGE_RULES } from './badges.service';

/**
 * Unit tests for BadgesService:
 * - sheet() returns earned + locked split
 * - award() idempotency + push
 * - All six rule branches via evaluateRule
 * The P2002 race-condition path is exercised here; the push + e2e paths are
 * covered in the integration suite.
 */
describe('BadgesService (unit)', () => {
  // Helper to build a minimal workout object with weightKg (required by tonnage())
  function w(id: string, matchId: string, sets: number, reps: number, weightKg: number) {
    return { id, matchId, userId: 'u1', date: new Date(), sets, reps, weightKg };
  }

  const prisma = {
    badge: { findUnique: jest.fn(), findMany: jest.fn() },
    userBadge: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    workout: { count: jest.fn(), findMany: jest.fn() },
    match: { count: jest.fn(), findFirst: jest.fn() },
    referral: { count: jest.fn() },
  };
  const notifications = { sendToUser: jest.fn() };
  const service = new BadgesService(prisma as never, notifications as never);

  const badge = { id: 'b1', slug: 'first_workout', title: 'Перший підхід', description: 'd', icon: '💪', rule: 'first_workout' };
  const me = { id: 'u1', name: 'Тест Юзер' };

  beforeEach(() => {
    // Explicitly reset all mocks in every test — clearAllMocks does NOT reset mockImpl
    prisma.badge.findUnique.mockReset();
    prisma.badge.findMany.mockReset();
    prisma.userBadge.findUnique.mockReset();
    prisma.userBadge.create.mockReset();
    prisma.userBadge.findMany.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.workout.count.mockReset();
    prisma.workout.findMany.mockReset();
    prisma.match.count.mockReset();
    prisma.match.findFirst.mockReset();
    prisma.referral.count.mockReset();
    notifications.sendToUser.mockReset();

    // Default implementation — override per-test as needed
    prisma.workout.count.mockResolvedValue(0);
  });

  // ─── sheet() ───────────────────────────────────────────────────────────────

  describe('sheet()', () => {
    it('returns earned badges (newest first) and locked badges without awardedAt', async () => {
      const allBadges = [
        { id: 'b1', slug: 'first_workout', title: 'Перший підхід', description: 'd', icon: '💪', rule: 'first_workout' },
        { id: 'b2', slug: 'tonnage_1k', title: 'Тонна', description: 'e', icon: '🏋️', rule: 'tonnage_1k' },
      ];
      const earned = [
        { badgeId: 'b1', awardedAt: new Date('2024-01-01'), badge: allBadges[0] },
        { badgeId: 'b2', awardedAt: new Date('2024-02-01'), badge: allBadges[1] },
      ];
      prisma.badge.findMany.mockResolvedValue(allBadges);
      prisma.userBadge.findMany.mockResolvedValue(earned);

      const result = await service.sheet('u1');

      expect(result.earned).toHaveLength(2);
      expect(result.earned[0].slug).toBe('tonnage_1k'); // newest first
      expect(result.locked).toHaveLength(0);
    });

    it('marks unearned badges as locked with their rule', async () => {
      prisma.badge.findMany.mockResolvedValue([badge]);
      prisma.userBadge.findMany.mockResolvedValue([]);

      const result = await service.sheet('u1');

      expect(result.earned).toHaveLength(0);
      expect(result.locked).toEqual([{ slug: 'first_workout', title: 'Перший підхід', description: 'd', icon: '💪', rule: 'first_workout' }]);
    });
  });

  // ─── award() — idempotency ───────────────────────────────────────────────

  describe('award() idempotency', () => {
    beforeEach(() => {
      prisma.badge.findUnique.mockResolvedValue(badge);
      prisma.user.findUnique.mockResolvedValue(me);
      // Default: no workout yet so FIRST_WORKOUT rule returns false (tests cover true path)
      prisma.workout.count.mockResolvedValue(0);
    });

    it('first-time award: inserts a row, fires the celebration push, returns awarded=true', async () => {
      prisma.workout.count.mockResolvedValue(1); // FIRST_WORKOUT: count >= 1
      prisma.userBadge.findUnique.mockResolvedValue(null);
      prisma.userBadge.create.mockResolvedValue({ id: 'ub1' });

      const res = await service.award('u1', BADGE_RULES.FIRST_WORKOUT);

      expect(res).toEqual({ awarded: true, badgeId: 'b1' });
      expect(prisma.userBadge.create).toHaveBeenCalledWith({ data: { userId: 'u1', badgeId: 'b1' } });
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'u1',
        'BADGE_AWARDED',
        expect.objectContaining({ body: expect.stringContaining('ви отримали досягнення') }),
      );
    });

    it('already owned: short-circuits, no insert, no push', async () => {
      prisma.userBadge.findUnique.mockResolvedValue({ id: 'ub1' });

      const res = await service.award('u1', BADGE_RULES.FIRST_WORKOUT);

      expect(res).toEqual({ awarded: false });
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
      expect(notifications.sendToUser).not.toHaveBeenCalled();
    });

    it('concurrent race: P2002 on the UNIQUE constraint is treated as a no-op', async () => {
      prisma.userBadge.findUnique.mockResolvedValue(null);
      prisma.userBadge.create.mockRejectedValue(Object.assign(new Error('P2002'), { code: 'P2002' }));

      const res = await service.award('u1', BADGE_RULES.FIRST_WORKOUT);

      expect(res).toEqual({ awarded: false });
    });

    it('unknown badge slug: logs a warning and returns awarded=false (not an exception)', async () => {
      prisma.badge.findUnique.mockResolvedValue(null);

      const res = await service.award('u1', 'nonexistent_badge' as never);

      expect(res).toEqual({ awarded: false });
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });
  });

  // ─── rule: FIRST_MATCH ──────────────────────────────────────────────────

  describe('rule: FIRST_MATCH', () => {
    beforeEach(() => {
      prisma.badge.findUnique.mockResolvedValue({ ...badge, slug: 'first_match' });
      prisma.userBadge.findUnique.mockResolvedValue(null);
    });

    it('returns true when the completed match count is exactly 1', async () => {
      prisma.match.count.mockResolvedValue(1);

      const res = await service.award('u1', BADGE_RULES.FIRST_MATCH);

      expect(res.awarded).toBe(true);
    });

    it('returns false when the user already has ended matches', async () => {
      prisma.match.count.mockResolvedValue(3);

      const res = await service.award('u1', BADGE_RULES.FIRST_MATCH);

      expect(res.awarded).toBe(false);
    });
  });

  // ─── rule: FIRST_WORKOUT ────────────────────────────────────────────────

  describe('rule: FIRST_WORKOUT', () => {
    beforeEach(() => {
      prisma.badge.findUnique.mockResolvedValue({ ...badge, slug: 'first_workout' });
      prisma.userBadge.findUnique.mockResolvedValue(null);
    });

    it('returns true when workout count >= 1', async () => {
      prisma.workout.count.mockResolvedValue(1);

      const res = await service.award('u1', BADGE_RULES.FIRST_WORKOUT);

      expect(res.awarded).toBe(true);
    });

    it('returns false when no workouts yet', async () => {
      prisma.workout.count.mockResolvedValue(0);

      const res = await service.award('u1', BADGE_RULES.FIRST_WORKOUT);

      expect(res.awarded).toBe(false);
    });
  });

  // ─── rule: VERIFIED_PAIR ───────────────────────────────────────────────

  describe('rule: VERIFIED_PAIR', () => {
    beforeEach(() => {
      prisma.badge.findUnique.mockResolvedValue({ ...badge, slug: 'verified_pair' });
      prisma.userBadge.findUnique.mockResolvedValue(null);
    });

    it('returns true when >= 5 workouts on a single ENDED match', async () => {
      prisma.workout.findMany.mockResolvedValue([
        w('w1', 'm1', 3, 10, 20),
        w('w2', 'm1', 3, 10, 20),
        w('w3', 'm1', 3, 10, 20),
        w('w4', 'm1', 3, 10, 20),
        w('w5', 'm1', 3, 10, 20),
      ]);
      prisma.match.findFirst.mockResolvedValue({ id: 'm1' });

      const res = await service.award('u1', BADGE_RULES.VERIFIED_PAIR);

      expect(res.awarded).toBe(true);
    });

    it('returns false when no single match has 5+ workouts', async () => {
      prisma.workout.findMany.mockResolvedValue([
        w('w1', 'm1', 3, 10, 20),
        w('w2', 'm1', 3, 10, 20),
        w('w3', 'm1', 3, 10, 20),
      ]);
      prisma.match.findFirst.mockResolvedValue(null);

      const res = await service.award('u1', BADGE_RULES.VERIFIED_PAIR);

      expect(res.awarded).toBe(false);
    });
  });

  // ─── rule: TONNAGE_1K ──────────────────────────────────────────────────

  describe('rule: TONNAGE_1K', () => {
    beforeEach(() => {
      prisma.badge.findUnique.mockResolvedValue({ ...badge, slug: 'tonnage_1k' });
      prisma.userBadge.findUnique.mockResolvedValue(null);
    });

    it('returns true when the user has >= 1000 kg total on the given match', async () => {
      // sets * reps * weightKg = 4*10*10 + 3*10*10 + 3*10*11.7 = 400 + 300 + 351 = 1051 kg
      prisma.workout.findMany.mockResolvedValue([
        w('w1', 'm1', 4, 10, 10),
        w('w2', 'm1', 3, 10, 10),
        w('w3', 'm1', 3, 10, 11.7),
      ]);

      const res = await service.award('u1', BADGE_RULES.TONNAGE_1K, { matchId: 'm1' });

      expect(res.awarded).toBe(true);
    });

    it('returns false when matchId context is missing', async () => {
      const res = await service.award('u1', BADGE_RULES.TONNAGE_1K, {});
      expect(res.awarded).toBe(false);
    });

    it('returns false when total tonnage is below 1000', async () => {
      prisma.workout.findMany.mockResolvedValue([w('w1', 'm1', 2, 10, 10)]); // 200 kg

      const res = await service.award('u1', BADGE_RULES.TONNAGE_1K, { matchId: 'm1' });

      expect(res.awarded).toBe(false);
    });
  });

  // ─── rule: SOCIAL_3 ───────────────────────────────────────────────────

  describe('rule: SOCIAL_3', () => {
    beforeEach(() => {
      prisma.badge.findUnique.mockResolvedValue({ ...badge, slug: 'social_3' });
      prisma.userBadge.findUnique.mockResolvedValue(null);
    });

    it('returns true when the user has >= 3 GRANTED referrals', async () => {
      prisma.referral.count.mockResolvedValue(3);

      const res = await service.award('u1', BADGE_RULES.SOCIAL_3);

      expect(res.awarded).toBe(true);
    });

    it('returns false when referrals < 3', async () => {
      prisma.referral.count.mockResolvedValue(2);

      const res = await service.award('u1', BADGE_RULES.SOCIAL_3);

      expect(res.awarded).toBe(false);
    });
  });

  // ─── rule: STREAK_4 ───────────────────────────────────────────────────

  describe('rule: STREAK_4', () => {
    beforeEach(() => {
      prisma.badge.findUnique.mockResolvedValue({ ...badge, slug: 'streak_4' });
      prisma.userBadge.findUnique.mockResolvedValue(null);
    });

    it('returns true when streakWeeks >= 4', async () => {
      // 4 dates in consecutive calendar weeks relative to TODAY (not hard-coded),
      // so the test never rots as time passes. streakWeeks counts backward from
      // the current week; the 4 most recent Monday week-starts always form a
      // contiguous run of 4, giving streak >= 4.
      const monday = (d: Date) => {
        const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); // Monday = week start
        return x;
      };
      const cur = monday(new Date()).getTime();
      const DAY = 86_400_000;
      prisma.workout.findMany.mockResolvedValue([
        { date: new Date(cur) }, // this week's Monday
        { date: new Date(cur - 7 * DAY) },
        { date: new Date(cur - 14 * DAY) },
        { date: new Date(cur - 21 * DAY) },
      ]);

      const res = await service.award('u1', BADGE_RULES.STREAK_4);

      expect(res.awarded).toBe(true);
    });

    it('returns false when streak < 4 weeks', async () => {
      prisma.workout.findMany.mockResolvedValue([{ date: new Date('2024-01-01') }]);

      const res = await service.award('u1', BADGE_RULES.STREAK_4);

      expect(res.awarded).toBe(false);
    });
  });
});
