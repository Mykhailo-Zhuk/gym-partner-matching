import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ChatService, firstName, toPayload } from '../chat/chat.service';
import { NotificationTypes, NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RemindersService } from '../reminders/reminders.service';
import { assertActive, participantMatch } from './match-access';

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly reminders: RemindersService,
    private readonly notifications: NotificationsService,
  ) {}

  /** GET /matches — my matches with partner card + last message (chat list entry point). */
  async myMatches(userId: string) {
    const matches = await this.prisma.match.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { createdAt: 'desc' },
      include: {
        userA: { select: { id: true, name: true, photoUrl: true, level: true } },
        userB: { select: { id: true, name: true, photoUrl: true, level: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { name: true } } } },
      },
    });
    return {
      items: matches.map((m) => {
        const partner = m.userAId === userId ? m.userB : m.userA;
        const last = m.messages[0];
        return {
          id: m.id,
          status: m.status,
          scheduledAt: m.scheduledAt,
          createdAt: m.createdAt,
          partner,
          lastMessage: last
            ? toPayload(last, last.sender ? firstName(last.sender.name) : null)
            : null,
        };
      }),
    };
  }

  /**
   * PATCH /matches/:id/schedule — set/move/cancel the planned workout.
   * Reminder jobs are fully re-synced (remove-then-add) → idempotent, no orphans.
   */
  async schedule(matchId: string, userId: string, scheduledAtIso: string | null) {
    const match = await participantMatch(this.prisma, matchId, userId);
    assertActive(match);

    const scheduledAt = scheduledAtIso ? new Date(scheduledAtIso) : null;
    if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('Час тренування має бути в майбутньому');
    }

    const updated = await this.prisma.match.update({ where: { id: matchId }, data: { scheduledAt } });
    await this.reminders.syncForMatch(matchId);
    return { id: updated.id, status: updated.status, scheduledAt: updated.scheduledAt };
  }

  /** POST /matches/:id/end — end the match; pending reminders are invalidated. */
  async end(matchId: string, userId: string) {
    const match = await participantMatch(this.prisma, matchId, userId);
    if (match.status === 'ENDED') throw new ConflictException('Матч вже завершено');

    const updated = await this.prisma.match.update({ where: { id: matchId }, data: { status: 'ENDED' } });
    await this.reminders.cancelForMatch(match);
    return { id: updated.id, status: updated.status };
  }

  /**
   * POST /matches/:id/en-route — story #4 action from the T-15 push:
   * partner gets "{name} вже в дорозі!" and a system message lands in the chat.
   */
  async enRoute(matchId: string, userId: string) {
    const match = await participantMatch(this.prisma, matchId, userId);
    assertActive(match);

    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    const partnerId = match.userAId === userId ? match.userBId : match.userAId;
    const name = firstName(me.name);

    const [systemMessage] = await Promise.all([
      this.chat.createSystemMessage(matchId, `${name} в дорозі 🚗`),
      this.notifications.sendToUser(partnerId, NotificationTypes.PARTNER_EN_ROUTE, {
        title: 'GymBrosUK',
        body: `${name} вже в дорозі!`,
        data: { matchId, deeplink: `gymbros://matches/${matchId}/chat` },
      }),
    ]);
    return { ok: true as const, systemMessage };
  }
}
