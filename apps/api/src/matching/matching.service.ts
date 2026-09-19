import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Goal, Level, Prisma, User } from '@prisma/client';
import { RequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Anonymized preview card — intentionally no id/email/photo before registration. */
export interface PreviewCard {
  firstName: string;
  level: Level | null;
  goal: Goal | null;
  gymName: string | null;
  schedule: string | null;
  ratingAverage: number | null;
  ratingCount: number;
}

/** Full search card — includes id for requesting. */
export interface SearchCard extends PreviewCard {
  id: string;
  photoUrl: string | null;
  bio: string | null;
}

interface SearchFilters {
  level?: Level;
  goal?: Goal;
  schedule?: string;
  gymId?: string;
}

const PREVIEW_COUNT = 5;
const MIN_CARDS = 3;

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // --- Preview (existing, unchanged) ---
  async preview(filters: { goal?: Goal; level?: Level; gymId?: string }): Promise<{ cards: PreviewCard[] }> {
    const base: Prisma.UserWhereInput = { status: 'ACTIVE', role: 'USER' };

    let users = await this.fetch({ ...base, goal: filters.goal, level: filters.level, gymId: filters.gymId });
    if (users.length < MIN_CARDS && (filters.goal || filters.level)) {
      users = await this.fetch({ ...base, gymId: filters.gymId });
    }
    if (users.length < MIN_CARDS && filters.gymId) {
      users = await this.fetch(base);
    }

    const ratings = await this.ratingSummaries(users.map((u) => u.id));
    return { cards: shuffle(users).slice(0, PREVIEW_COUNT).map((u) => toPreviewCard(u, ratings.get(u.id))) };
  }

  // --- Search (Part 2 #1) ---
  async search(
    userId: string,
    filters: SearchFilters,
  ): Promise<{ cards: SearchCard[] }> {
    const where: Prisma.UserWhereInput = {
      status: 'ACTIVE',
      role: 'USER',
      id: { not: userId },
      level: filters.level,
      goal: filters.goal,
      schedule: filters.schedule ? { contains: filters.schedule, mode: 'insensitive' } : undefined,
      gymId: filters.gymId,
    };

    const users = await this.prisma.user.findMany({
      where,
      take: 50,
      include: { gym: true },
    });

    // Exclude users with pending/declined requests from this user AND already-matched
    // users. Both exclusion queries are independent — run them concurrently to cut
    // the endpoint's DB latency on the critical path.
    const uids = users.map((u) => u.id);
    const [existing, matched] = await Promise.all([
      this.prisma.matchRequest.findMany({
        where: {
          fromUserId: userId,
          status: { in: ['PENDING', 'DECLINED'] },
          toUserId: { in: uids },
        },
        select: { toUserId: true },
      }),
      this.prisma.match.findMany({
        where: {
          status: 'ACTIVE',
          OR: [{ userAId: userId, userBId: { in: uids } }, { userBId: userId, userAId: { in: uids } }],
        },
        select: { userAId: true, userBId: true },
      }),
    ]);
    const excluded = new Set(existing.map((r) => r.toUserId));
    for (const m of matched) {
      excluded.add(m.userAId === userId ? m.userBId : m.userAId);
    }

    const eligible = users.filter((u) => !excluded.has(u.id));
    const ratings = await this.ratingSummaries(eligible.map((u) => u.id));
    return { cards: shuffle(eligible).slice(0, 20).map((u) => toSearchCard(u, ratings.get(u.id))) };
  }

  // --- Request (Part 2 #1) ---
  async createRequest(fromUserId: string, toUserId: string) {
    if (fromUserId === toUserId) throw new ForbiddenException('Cannot send request to yourself');

    // Independent reads — check for an existing request and validate the target
    // concurrently. Validation order (Conflict before NotFound) is preserved below.
    const [existing, toUser] = await Promise.all([
      this.prisma.matchRequest.findFirst({ where: { fromUserId, toUserId } }),
      this.prisma.user.findUnique({ where: { id: toUserId } }),
    ]);
    if (existing) throw new ConflictException('Request already exists');
    if (!toUser) throw new NotFoundException('User not found');
    if (toUser.status !== 'ACTIVE') throw new ForbiddenException('User is not available');

    const request = await this.prisma.matchRequest.create({
      data: { fromUserId, toUserId },
    });

    // Push notification to recipient
    await this.notifications.sendToUser(toUserId, 'MATCH_REQUEST', {
      title: 'Новий запит на партнера! 💪',
      body: `Користувач хоче бути твоїм партнером для тренувань`,
      data: { type: 'MATCH_REQUEST', requestId: request.id },
    });

    return { id: request.id, status: request.status, createdAt: request.createdAt };
  }

  // --- Accept/Decline (Part 2 #1) ---
  async respondToRequest(requestId: string, userId: string, accept: boolean) {
    const request = await this.prisma.matchRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.toUserId !== userId) throw new ForbiddenException('Only the recipient can respond');
    if (request.status !== 'PENDING') throw new ConflictException('Request is no longer pending');

    if (accept) {
      // Create match with both users
      const [userAId, userBId] = request.fromUserId < request.toUserId
        ? [request.fromUserId, request.toUserId]
        : [request.toUserId, request.fromUserId];

      await this.prisma.match.create({ data: { userAId, userBId } });
      await this.prisma.matchRequest.update({ where: { id: requestId }, data: { status: 'ACCEPTED' } });

      // Notify sender
      await this.notifications.sendToUser(request.fromUserId, 'MATCH_ACCEPTED', {
        title: 'Запит прийнято! 🎉',
        body: 'Ваш запит на партнерство прийнято. Ласкаво просимо до спільних тренувань!',
        data: { type: 'MATCH_ACCEPTED', requestId },
      });

      return { status: 'ACCEPTED' as const };
    } else {
      await this.prisma.matchRequest.update({ where: { id: requestId }, data: { status: 'DECLINED' } });
      return { status: 'DECLINED' as const };
    }
  }

  // --- List incoming requests (Part 2 #1) ---
  async listIncomingRequests(userId: string) {
    const requests = await this.prisma.matchRequest.findMany({
      where: { toUserId: userId, status: 'PENDING' },
      include: { fromUser: { select: { id: true, name: true, photoUrl: true, level: true, goal: true, gym: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return { requests };
  }

  // --- Private helpers ---
  private fetch(where: Prisma.UserWhereInput) {
    return this.prisma.user.findMany({ where, take: 50, include: { gym: true } });
  }

  private async ratingSummaries(userIds: string[]) {
    const map = new Map<string, { average: number; count: number }>();
    if (userIds.length === 0) return map;
    const rows = await this.prisma.rating.groupBy({
      by: ['rateeId'],
      where: { rateeId: { in: userIds } },
      _avg: { punctuality: true, communication: true, spotting: true },
      _count: { _all: true },
    });
    for (const r of rows) {
      const avg = ((r._avg.punctuality ?? 0) + (r._avg.communication ?? 0) + (r._avg.spotting ?? 0)) / 3;
      map.set(r.rateeId, { average: Math.round(avg * 10) / 10, count: r._count._all });
    }
    return map;
  }
}

/** First token of a display name, or a fallback when empty. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Користувач';
}

export function toPreviewCard(
  user: User & { gym: { name: string } | null },
  rating?: { average: number; count: number },
): PreviewCard {
  return {
    firstName: firstName(user.name),
    level: user.level,
    goal: user.goal,
    gymName: user.gym?.name ?? null,
    schedule: user.schedule,
    ratingAverage: rating?.average ?? null,
    ratingCount: rating?.count ?? 0,
  };
}

export function toSearchCard(
  user: User & { gym: { name: string } | null },
  rating?: { average: number; count: number },
): SearchCard {
  return {
    id: user.id,
    firstName: firstName(user.name),
    photoUrl: user.photoUrl,
    bio: user.bio,
    level: user.level,
    goal: user.goal,
    gymName: user.gym?.name ?? null,
    schedule: user.schedule,
    ratingAverage: rating?.average ?? null,
    ratingCount: rating?.count ?? 0,
  };
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
