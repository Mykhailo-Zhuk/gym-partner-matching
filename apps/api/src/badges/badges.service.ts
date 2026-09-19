import { Injectable, Logger } from '@nestjs/common';
import { firstName } from '../chat/chat.service';
import { streakWeeks, tonnage } from '../dashboard/stats';
import { NotificationTypes, NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Part 5 (#10) — Badges.
 *
 * Event-driven engine: every rule is a string slug evaluated against a small
 * JSON-shaped context. Hooks live in the calling services (workout / match /
 * referral). The DB UNIQUE on (user_id, badge_id) is the idempotency
 * guarantee — concurrent retries cannot double-award.
 *
 * MVP rule set (kept in code so a feature change ships with the deploy; the
 * badges table itself just stores the display copy):
 *  - "first_match"     awarded on a user's first completed match
 *  - "verified_pair"   awarded when a user has 5+ workouts with the same partner
 *  - "first_workout"   awarded on the first workout of any kind
 *  - "tonnage_1k"      awarded when total tonnage on a single match >= 1000 kg
 *  - "social_3"        awarded when a user has referred 3+ people
 *  - "streak_4"        awarded when the user has 4+ weeks of workout activity
 */

export const BADGE_RULES = {
  FIRST_MATCH: 'first_match',
  VERIFIED_PAIR: 'verified_pair',
  FIRST_WORKOUT: 'first_workout',
  TONNAGE_1K: 'tonnage_1k',
  SOCIAL_3: 'social_3',
  STREAK_4: 'streak_4',
} as const;

export type BadgeRuleSlug = (typeof BADGE_RULES)[keyof typeof BADGE_RULES];

@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Get the user's full badge sheet — earned badges first, locked badges below
   * with their unlock rule. Stories #10 AC: "Locked badges show unlock conditions".
   */
  async sheet(userId: string) {
    const [allBadges, earned] = await Promise.all([
      this.prisma.badge.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.userBadge.findMany({ where: { userId }, include: { badge: true } }),
    ]);
    const earnedByBadgeId = new Map(earned.map((e) => [e.badgeId, e]));
    const earnedItems = earned
      .sort((a, b) => b.awardedAt.getTime() - a.awardedAt.getTime())
      .map((e) => ({
        slug: e.badge.slug,
        title: e.badge.title,
        description: e.badge.description,
        icon: e.badge.icon,
        awardedAt: e.awardedAt,
      }));
    const lockedItems = allBadges
      .filter((b) => !earnedByBadgeId.has(b.id))
      .map((b) => ({ slug: b.slug, title: b.title, description: b.description, icon: b.icon, rule: b.rule }));
    return { earned: earnedItems, locked: lockedItems };
  }

  /**
   * Try to award `slug` to `userId`. Returns the award (or null if already owned /
   * rule unmet). Single-user path: read the badge by slug, evaluate the rule,
   * insert on success. Idempotency: the UNIQUE on (user_id, badge_id) makes
   * double-fires a no-op.
   */
  async award(userId: string, slug: BadgeRuleSlug, ctx: BadgeContext = {}): Promise<{ awarded: boolean; badgeId?: string }> {
    const badge = await this.prisma.badge.findUnique({ where: { slug } });
    if (!badge) {
      this.logger.warn(`Unknown badge slug "${slug}" — was the catalogue seeded?`);
      return { awarded: false };
    }

    const already = await this.prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
    });
    if (already) return { awarded: false };

    if (!(await this.evaluateRule(userId, slug, ctx))) return { awarded: false };

    try {
      await this.prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
    } catch (error) {
      // P2002 = UNIQUE violation. A concurrent caller won the race; treat as no-op.
      if ((error as { code?: string }).code === 'P2002') return { awarded: false };
      throw error;
    }

    // Celebration push — best-effort. Mobile uses this for the in-app moment
    // (deferred: actual shareable image generation lives in the client).
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await this.notifications.sendToUser(userId, NotificationTypes.BADGE_AWARDED, {
      title: 'GymBrosUK',
      body: `🏅 ${firstName(me?.name ?? 'Користувач')}, ви отримали досягнення: «${badge.title}»`,
      data: { slug: badge.slug, deeplink: 'gymbros://profile/badges' },
    });
    this.logger.log(`Badge awarded: ${slug} -> user ${userId}`);
    return { awarded: true, badgeId: badge.id };
  }

  /**
   * Evaluate the rule for a single user/slug. Most rules boil down to one or two
   * prisma counts / aggregations — cheap enough to call inline at every hook.
   */
  private async evaluateRule(userId: string, slug: BadgeRuleSlug, ctx: BadgeContext): Promise<boolean> {
    switch (slug) {
      case BADGE_RULES.FIRST_MATCH: {
        // Triggered explicitly on /matches/:id/complete — only when the match
        // we're completing is the user's first ever ended match.
        const completedCount = await this.prisma.match.count({
          where: { status: 'ENDED', OR: [{ userAId: userId }, { userBId: userId }] },
        });
        return completedCount === 1; // 1 because this match was just flipped to ENDED
      }

      case BADGE_RULES.FIRST_WORKOUT: {
        const count = await this.prisma.workout.count({ where: { userId } });
        return count >= 1;
      }

      case BADGE_RULES.VERIFIED_PAIR: {
        // 5+ workouts on a SINGLE match — the same partner stick-around signal.
        // Two cheap reads: find a match with >=5 user workouts, then check it ended.
        const candidates = await this.prisma.workout.findMany({
          where: { userId },
          select: { matchId: true },
        });
        const counts = new Map<string, number>();
        for (const c of candidates) counts.set(c.matchId, (counts.get(c.matchId) ?? 0) + 1);
        const heavy = [...counts.entries()].filter(([, n]) => n >= 5).map(([id]) => id);
        if (heavy.length === 0) return false;
        const ended = await this.prisma.match.findFirst({
          where: { id: { in: heavy }, status: 'ENDED' },
          select: { id: true },
        });
        return ended !== null;
      }

      case BADGE_RULES.TONNAGE_1K: {
        const matchId = ctx.matchId;
        if (!matchId) return false;
        // Per-user tonnage on this match: each partner can hit the 1k milestone
        // independently because workouts are user-attributed.
        const workouts = await this.prisma.workout.findMany({ where: { matchId, userId } });
        const total = workouts.reduce((sum, w) => sum + tonnage(w), 0);
        return total >= 1000;
      }

      case BADGE_RULES.SOCIAL_3: {
        const count = await this.prisma.referral.count({ where: { referrerId: userId, status: 'GRANTED' } });
        return count >= 3;
      }

      case BADGE_RULES.STREAK_4: {
        // 4+ weeks of workout activity (mirrors the dashboard's streakWeeks so
        // the rule matches the user's perception).
        const dates = (await this.prisma.workout.findMany({ where: { userId }, select: { date: true } })).map(
          (w) => w.date,
        );
        return streakWeeks(dates) >= 4;
      }

      default:
        return false;
    }
  }
}

export interface BadgeContext {
  matchId?: string;
}
