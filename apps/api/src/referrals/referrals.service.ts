import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BadgesService, BADGE_RULES } from '../badges/badges.service';
import { firstName } from '../chat/chat.service';
import { NotificationTypes, NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/** Part 5 (#9) — Referrals. Story: "Код GYM2024 used at registration → both users get push + bonus". */
const BONUS_DAYS = 3;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — easy to read aloud
const CODE_LENGTH = 8;

// ponytail: in-process code uniqueness check. Pairs of findUnique+create retries
// are O(1) for an 8-char base32 alphabet (~10^14 space); collisions are vanishingly
// rare and the DB unique index on `code` is the real guarantee. Upgrade path if
// traffic ever pushes us off a single process: swap to a DB sequence or ULID.
async function uniqueCode(prisma: PrismaService): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
    const taken = await prisma.referralCode.findUnique({ where: { code } });
    if (!taken) return code;
  }
  throw new Error('Could not generate a unique referral code');
}

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly badges: BadgesService,
  ) {}

  /**
   * Cheap existence check used by the auth register flow to validate a code BEFORE
   * creating a user. Throws "Код не знайдено" if the code is unknown. Self-referral
   * is impossible here because the registering user has no code yet.
   */
  async assertCodeValid(rawCode: string): Promise<void> {
    const code = rawCode.trim().toUpperCase();
    const found = code ? await this.prisma.referralCode.findUnique({ where: { code } }) : null;
    if (!found) throw new BadRequestException('Код не знайдено');
  }

  /** GET or create the caller's personal code (idempotent — same code forever). */
  async myCode(userId: string): Promise<{ code: string; shareLink: string; redemptions: number }> {
    const existing = await this.prisma.referralCode.findUnique({ where: { userId } });
    const code = existing ?? (await this.prisma.referralCode.create({ data: { userId, code: await uniqueCode(this.prisma) } }));
    const redemptions = await this.prisma.referral.count({ where: { codeId: code.id } });
    const shareLink = `${process.env.PUBLIC_BASE_URL ?? 'https://gymbros.uk'}/r/${code.code}`;
    return { code: code.code, shareLink, redemptions };
  }

  /**
   * Apply a referral code at registration. If invalid → returns the exact
   * Gherkin message ("Код не знайдено") so the onboarding path can surface it.
   * Bonus is `BONUS_DAYS` of subscription for BOTH sides; idempotent on retries.
   *
   * `strict=true` (email registration): an unknown code is a 400 so the
   * onboarding screen can show "Код не знайдено" verbatim.
   * `strict=false` (social login): a bad/missing code is silently ignored —
   * Google/Apple flows must never fail on a typo from a referrer.
   */
  async applyCode(refereeId: string, rawCode: string, opts: { strict: boolean } = { strict: false }): Promise<{ applied: boolean; referrerId?: string }> {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      if (opts.strict) throw new BadRequestException('Код не знайдено');
      return { applied: false };
    }

    const referralCode = await this.prisma.referralCode.findUnique({ where: { code } });
    if (!referralCode || referralCode.userId === refereeId) {
      if (opts.strict) throw new BadRequestException('Код не знайдено');
      return { applied: false };
    }

    // Idempotency: a referee can only be referred once (UNIQUE on referee_id).
    const existing = await this.prisma.referral.findUnique({ where: { refereeId } });
    if (existing) return { applied: true, referrerId: existing.referrerId };

    const referee = await this.prisma.user.findUniqueOrThrow({ where: { id: refereeId } });
    const newUntil = new Date();
    if (referee.subscriptionUntil && referee.subscriptionUntil > newUntil) newUntil.setTime(referee.subscriptionUntil.getTime());
    newUntil.setUTCDate(newUntil.getUTCDate() + BONUS_DAYS);

    await this.prisma.$transaction(async (tx) => {
      await tx.referral.create({
        data: {
          codeId: referralCode.id,
          referrerId: referralCode.userId,
          refereeId,
          status: 'GRANTED',
          bonusGrantedAt: new Date(),
        },
      });
      // Bonus to referee: extend the window (never shrink an existing premium).
      await tx.user.update({ where: { id: refereeId }, data: { subscriptionUntil: newUntil, referredByCodeId: referralCode.id } });
      // Bonus to referrer: same window extension rule.
      const referrer = await tx.user.findUniqueOrThrow({ where: { id: referralCode.userId } });
      const referrerUntil = new Date();
      if (referrer.subscriptionUntil && referrer.subscriptionUntil > referrerUntil) referrerUntil.setTime(referrer.subscriptionUntil.getTime());
      referrerUntil.setUTCDate(referrerUntil.getUTCDate() + BONUS_DAYS);
      await tx.user.update({ where: { id: referrer.id }, data: { subscriptionUntil: referrerUntil } });
    });

    // Push both sides — best-effort, registration is already done.
    await Promise.all([
      this.notifications.sendToUser(refereeId, NotificationTypes.REFERRAL_BONUS, {
        title: 'GymBrosUK',
        body: `Ласкаво просимо! +${BONUS_DAYS} днів преміуму за запрошення`,
        data: { deeplink: 'gymbros://profile' },
      }),
      this.notifications.sendToUser(referralCode.userId, NotificationTypes.REFERRAL_BONUS, {
        title: 'GymBrosUK',
        body: `${firstName(referee.name)} активував ваш код! +${BONUS_DAYS} днів преміуму`,
        data: { deeplink: 'gymbros://profile' },
      }),
    ]);
    // Part 5 (#10) badge hook: 3 successful referrals -> social_3.
    await this.badges.award(referralCode.userId, BADGE_RULES.SOCIAL_3);
    this.logger.log(`Referral applied: ${referralCode.code} -> referee ${refereeId} (referrer ${referralCode.userId})`);
    return { applied: true, referrerId: referralCode.userId };
  }

  /** GET /admin/referrals/stats — overview for the admin panel. */
  async adminStats() {
    const [codes, granted] = await Promise.all([
      this.prisma.referralCode.count(),
      this.prisma.referral.count({ where: { status: 'GRANTED' } }),
    ]);
    const top = await this.prisma.referral.groupBy({
      by: ['referrerId'],
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });
    const referrerIds = top.map((t) => t.referrerId);
    const users = referrerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: referrerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      totalCodes: codes,
      totalGranted: granted,
      topReferrers: top.map((t) => ({
        userId: t.referrerId,
        name: byId.get(t.referrerId)?.name ?? '—',
        email: byId.get(t.referrerId)?.email ?? null,
        count: t._count._all,
      })),
    };
  }
}
