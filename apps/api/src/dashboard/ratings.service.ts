import { Injectable } from '@nestjs/common';
import type { Rating } from '@prisma/client';
import { BadgesService, BADGE_RULES } from '../badges/badges.service';
import { firstName } from '../chat/chat.service';
import { assertActive, participantMatch, partnerIdOf } from '../matches/match-access';
import { PrismaService } from '../prisma/prisma.service';
import { RemindersService } from '../reminders/reminders.service';
import type { CompleteMatchDto } from './dto/complete-match.dto';

/** Story #5 — rate the partner on workout completion; reputation readable before a request. */
@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reminders: RemindersService,
    private readonly badges: BadgesService,
  ) {}

  /**
   * POST /matches/:id/complete — "Завершити тренування". Ends the match (like /end,
   * reminders cancelled); body may carry the 3-criteria rating or nothing ("Пропустити").
   */
  async complete(matchId: string, userId: string, dto: CompleteMatchDto) {
    const match = await participantMatch(this.prisma, matchId, userId);
    assertActive(match); // 409 MATCH_INACTIVE on re-complete or declined/pending

    let rating: Rating | null = null;
    if (dto.rating) {
      rating = await this.prisma.rating.create({
        data: {
          matchId,
          raterId: userId,
          rateeId: partnerIdOf(match, userId),
          punctuality: dto.rating.punctuality,
          communication: dto.rating.communication,
          spotting: dto.rating.spotting,
          comment: dto.rating.comment ?? null,
        },
      });
    }

    const updated = await this.prisma.match.update({ where: { id: matchId }, data: { status: 'ENDED' } });
    await this.reminders.cancelForMatch(match);

    // Part 5 (#10) badge hooks — fire on both partners (each sees their own sheet).
    // Awaited: tests / API clients reading /users/me/badges right after a complete
    // call must see the newly-awarded badge without a sleep.
    for (const uid of [match.userAId, match.userBId]) {
      await this.badges.award(uid, BADGE_RULES.FIRST_MATCH, { matchId });
      await this.badges.award(uid, BADGE_RULES.VERIFIED_PAIR, { matchId });
      await this.badges.award(uid, BADGE_RULES.TONNAGE_1K, { matchId });
    }

    // Mobile copy hook: ratingSkipped => show "Завершено без оцінки".
    return { id: updated.id, status: updated.status, rating, ratingSkipped: !rating };
  }

  /** GET /users/:id/rating-summary — average (1 decimal), count, last 3 comments. */
  async ratingSummary(userId: string) {
    const [agg, comments] = await Promise.all([
      this.prisma.rating.aggregate({
        where: { rateeId: userId },
        _avg: { punctuality: true, communication: true, spotting: true },
        _count: { _all: true },
      }),
      this.prisma.rating.findMany({
        where: { rateeId: userId, comment: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          comment: true,
          createdAt: true,
          punctuality: true,
          communication: true,
          spotting: true,
          rater: { select: { name: true } },
        },
      }),
    ]);

    const count = agg._count._all;
    const average = count
      ? Math.round((((agg._avg.punctuality ?? 0) + (agg._avg.communication ?? 0) + (agg._avg.spotting ?? 0)) / 3) * 10) / 10
      : null;

    return {
      average,
      count,
      comments: comments.map((c) => ({
        comment: c.comment,
        createdAt: c.createdAt,
        authorName: firstName(c.rater.name),
        score: Math.round(((c.punctuality + c.communication + c.spotting) / 3) * 10) / 10,
      })),
    };
  }
}
