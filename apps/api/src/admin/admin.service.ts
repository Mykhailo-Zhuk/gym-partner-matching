import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, UserStatus } from '@prisma/client';
import { AuditActions, AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import type { Paginated, PaginationQuery } from '../common/pagination';
import { NotificationTypes, NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';

interface ListUsersParams extends PaginationQuery {
  search?: string;
  status?: UserStatus;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async listUsers(params: ListUsersParams): Promise<Paginated<unknown>> {
    const where: Prisma.UserWhereInput = {
      role: 'USER',
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: 'insensitive' } },
              { name: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          level: true,
          goal: true,
          createdAt: true,
          gym: { select: { name: true } },
          _count: { select: { reportsReceived: true } },
        },
      }),
    ]);

    return {
      items: items.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        status: u.status,
        level: u.level,
        goal: u.goal,
        gymName: u.gym?.name ?? null,
        reportsReceivedCount: u._count.reportsReceived,
        createdAt: u.createdAt,
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  /** Full user card per story #3: profile + dated reports (received & filed) + match history. */
  async getUserCard(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { gym: { select: { id: true, name: true, city: true } } },
    });
    if (!user) throw new NotFoundException('User not found');

    const [reportsReceived, reportsFiled, matches] = await Promise.all([
      this.prisma.report.findMany({
        where: { targetId: id },
        orderBy: { createdAt: 'desc' },
        include: { reporter: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.report.findMany({
        where: { reporterId: id },
        orderBy: { createdAt: 'desc' },
        include: { target: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.match.findMany({
        where: { OR: [{ userAId: id }, { userBId: id }] },
        orderBy: { createdAt: 'desc' },
        include: {
          userA: { select: { id: true, name: true } },
          userB: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        level: user.level,
        goal: user.goal,
        schedule: user.schedule,
        gym: user.gym,
        photoUrl: user.photoUrl,
        bio: user.bio,
        blockedReason: user.blockedReason,
        createdAt: user.createdAt,
      },
      reportsReceived: reportsReceived.map((r) => ({
        id: r.id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.createdAt,
        reporter: r.reporter,
      })),
      reportsFiled: reportsFiled.map((r) => ({
        id: r.id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.createdAt,
        target: r.target,
      })),
      matches: matches.map((m) => ({
        id: m.id,
        status: m.status,
        createdAt: m.createdAt,
        partner: m.userAId === id ? m.userB : m.userA,
      })),
    };
  }

  /**
   * Story #3 core value — moderation in <=2 minutes:
   * one call => status=blocked, sessions revoked, user pushed,
   * every ACTIVE match partner notified, audit entry written.
   */
  async blockUser(userId: string, reason: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new ConflictException('Cannot block an admin account');
    if (user.status === 'BLOCKED') throw new ConflictException('User is already blocked');

    const activeMatches = await this.prisma.match.findMany({
      where: { status: 'ACTIVE', OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true },
    });
    const partnerIds = activeMatches.map((m) => (m.userAId === userId ? m.userBId : m.userAId));

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status: 'BLOCKED', blockedReason: reason } });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: AuditActions.BLOCK_USER,
          targetType: 'user',
          targetId: userId,
          meta: { reason, notifiedMatchPartners: partnerIds.length },
        },
      });
    });

    // Best-effort delivery — the DB state above is the source of truth.
    // Chat access ends NOW: kill live sockets (REST is already covered by UserStatusGuard).
    await Promise.all([
      this.chatGateway.disconnectUser(userId),
      this.notifications.sendToUser(userId, NotificationTypes.USER_BLOCKED, {
        title: 'GymBrosUK',
        body: 'Обліковий запис заблоковано',
        data: { reason },
      }),
      this.notifications.sendToUsers(partnerIds, NotificationTypes.MATCH_PARTNER_BLOCKED, {
        title: 'GymBrosUK',
        body: 'Користувача заблоковано адміністрацією',
        data: { blockedUserId: userId },
      }),
    ]);

    return { id: userId, status: 'BLOCKED' as const, notifiedMatchPartners: partnerIds.length };
  }

  async unblockUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== 'BLOCKED') throw new ConflictException('User is not blocked');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status: 'ACTIVE', blockedReason: null } });
      await tx.auditLog.create({
        data: { actorId: adminId, action: AuditActions.UNBLOCK_USER, targetType: 'user', targetId: userId },
      });
    });

    await this.notifications.sendToUser(userId, NotificationTypes.USER_UNBLOCKED, {
      title: 'GymBrosUK',
      body: 'Ваш акаунт розблоковано',
    });

    return { id: userId, status: 'ACTIVE' as const };
  }

  async listAuditLog(params: PaginationQuery & { targetId?: string }): Promise<Paginated<unknown>> {
    const where: Prisma.AuditLogWhereInput = params.targetId ? { targetId: params.targetId } : {};
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
    return { items, total, page: params.page, pageSize: params.pageSize };
  }
}
