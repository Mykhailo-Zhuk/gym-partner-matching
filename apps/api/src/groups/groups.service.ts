import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { GroupMember, GroupMemberStatus, GroupMessage, MessageType } from '@prisma/client';
import { firstName } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationTypes, NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RemindersService } from '../reminders/reminders.service';
import { GROUP_MESSAGE_EVENT, GROUP_RESPONSE_EVENT, MAX_GROUP_SIZE } from './groups.constants';

const GROUP_DEEPLINK = (groupId: string) => `gymbros://groups/${groupId}`;

/** Wire format for the group chat realtime event. */
export interface GroupMessagePayload {
  id: string;
  groupId: string;
  senderId: string | null;
  senderName: string | null;
  type: MessageType;
  body: string | null;
  mediaUrl: string | null;
  createdAt: string;
}

function toGroupPayload(m: GroupMessage, senderName: string | null): GroupMessagePayload {
  return {
    id: m.id,
    groupId: m.groupId,
    senderId: m.senderId,
    senderName,
    type: m.type,
    body: m.body,
    mediaUrl: m.mediaUrl,
    createdAt: m.createdAt.toISOString(),
  };
}

/**
 * Part 5 (#11) — Group matching.
 * - 2..5 members (creator + 1..4 invitees), per plan.md cap.
 * - Chat is a sibling table (group_messages) so the existing (match_id, created_at)
 *   index on `messages` stays untouched.
 * - T-24h creator reminder piggybacks on the existing match-reminders queue.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gateway: ChatGateway,
    private readonly reminders: RemindersService,
  ) {}

  /** POST /groups — create + invite in one shot. The T-24h reminder is scheduled if scheduledAt is in the future. */
  async create(userId: string, input: { title: string; scheduledAt?: string | null; inviteeIds: string[] }): Promise<{ id: string; title: string; scheduledAt: Date | null; members: unknown[] }> {
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Title is required');

    const invitees = [...new Set(input.inviteeIds)];
    if (invitees.includes(userId)) throw new BadRequestException('Creator cannot invite themselves');
    if (invitees.length + 1 > MAX_GROUP_SIZE) throw new BadRequestException(`Max ${MAX_GROUP_SIZE} members per group`);

    const known = await this.prisma.user.findMany({
      where: { id: { in: invitees }, status: 'ACTIVE' },
      select: { id: true, name: true },
    });
    if (known.length !== invitees.length) {
      throw new BadRequestException('One or more invitees are unknown or blocked');
    }

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('Час тренування має бути в майбутньому');
    }

    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });

    const group = await this.prisma.groupMatch.create({
      data: {
        title,
        creatorId: userId,
        scheduledAt,
        members: { create: invitees.map((id) => ({ userId: id, status: 'INVITED' as GroupMemberStatus })) },
      },
      include: { members: { include: { user: { select: { id: true, name: true } } } } },
    });

    // Push invites to each invitee. Per-member, not batched: a missing device
    // for one must not lose the push for the others.
    await Promise.all(
      known.map((inv) =>
        this.notifications.sendToUser(inv.id, NotificationTypes.GROUP_INVITE, {
          title: 'GymBrosUK',
          body: `${firstName(me.name)} запрошує вас у групу «${group.title}»`,
          data: { groupId: group.id, deeplink: GROUP_DEEPLINK(group.id), action: 'open' },
        }),
      ),
    );

    if (scheduledAt) await this.reminders.scheduleGroupReminder(group);
    return this.toGroupView(group);
  }

  /** POST /groups/:id/respond — invitee accepts or declines. */
  async respond(groupId: string, userId: string, action: 'ACCEPT' | 'DECLINE'): Promise<{ status: GroupMemberStatus }> {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { group: { select: { id: true, title: true, creatorId: true, scheduledAt: true } } },
    });
    if (!member) throw new NotFoundException('Group invite not found');
    if (member.status !== 'INVITED') throw new ConflictException('Invite already responded');

    const status: GroupMemberStatus = action === 'ACCEPT' ? 'CONFIRMED' : 'DECLINED';
    await this.prisma.groupMember.update({
      where: { id: member.id },
      data: { status, respondedAt: new Date() },
    });

    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    await this.notifications.sendToUser(member.group.creatorId, NotificationTypes.GROUP_RESPONSE, {
      title: 'GymBrosUK',
      body: `${firstName(me.name)} ${action === 'ACCEPT' ? 'прийняв' : 'відхилив'} запрошення до «${member.group.title}»`,
      data: { groupId, deeplink: GROUP_DEEPLINK(groupId) },
    });
    // Realtime nudge for the creator's open client (so the member list updates live).
    this.gateway.broadcast(GROUP_RESPONSE_EVENT, [member.group.creatorId], {
      groupId,
      userId,
      status,
    });
    return { status };
  }

  /** GET /groups/:id — group view with member states. Caller must be the creator or a CONFIRMED member. */
  async get(groupId: string, userId: string) {
    const group = await this.prisma.groupMatch.findUnique({
      where: { id: groupId },
      include: { members: { include: { user: { select: { id: true, name: true } } } } },
    });
    if (!group) throw new NotFoundException('Group not found');
    const isCreator = group.creatorId === userId;
    const isMember = group.members.some((m) => m.userId === userId);
    if (!isCreator && !isMember) throw new NotFoundException('Group not found');
    return this.toGroupView(group);
  }

  /** GET /groups/:id/messages — group chat history (cursor pagination, same shape as pair chat). */
  async listMessages(groupId: string, userId: string, before: string | undefined, limit: number) {
    const group = await this.prisma.groupMatch.findUnique({
      where: { id: groupId },
      include: { members: { select: { userId: true, status: true } } },
    });
    if (!group) throw new NotFoundException('Group not found');
    const isMember = group.creatorId === userId || group.members.some((m) => m.userId === userId);
    if (!isMember) throw new NotFoundException('Group not found');

    let cursorFilter: { OR: [{ createdAt: { lt: Date } }, { createdAt: Date; id: { lt: string } }] } | undefined;
    if (before) {
      const cursor = await this.prisma.groupMessage.findFirst({ where: { id: before, groupId } });
      if (!cursor) throw new BadRequestException('Invalid cursor');
      cursorFilter = {
        OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }],
      };
    }

    const rows = await this.prisma.groupMessage.findMany({
      where: { groupId, ...(cursorFilter ?? {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { },
    });
    const senderIds = [...new Set(rows.map((r) => r.senderId).filter((id): id is string => !!id))];
    const senders = senderIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true } })
      : [];
    const senderNameById = new Map(senders.map((s) => [s.id, firstName(s.name)]));

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();
    return {
      items: page.map((m) => toGroupPayload(m, m.senderId ? senderNameById.get(m.senderId) ?? null : null)),
      nextCursor: hasMore ? page[0].id : null,
    };
  }

  /** POST /groups/:id/messages — fanout to every ACTIVE member; offline ones get an FCM push. */
  async sendMessage(
    groupId: string,
    userId: string,
    dto: { type: 'TEXT' | 'IMAGE'; body?: string; mediaUrl?: string; caption?: string },
  ): Promise<GroupMessagePayload> {
    const group = await this.prisma.groupMatch.findUnique({
      where: { id: groupId },
      include: { members: { select: { userId: true, status: true } } },
    });
    if (!group) throw new NotFoundException('Group not found');
    const member = group.creatorId === userId
      ? { userId, status: 'CONFIRMED' as GroupMemberStatus }
      : group.members.find((m) => m.userId === userId);
    if (!member || member.status === 'DECLINED') throw new NotFoundException('Group not found');

    const validated = this.validateMessage(dto);
    const message = await this.prisma.groupMessage.create({
      data: { groupId, senderId: userId, type: dto.type, body: validated.body, mediaUrl: validated.mediaUrl },
    });
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    const payload = toGroupPayload(message, firstName(me.name));

    // Fanout to the full member set minus the sender.
    const recipients = [group.creatorId, ...group.members.map((m) => m.userId)].filter((id) => id !== userId);
    this.gateway.broadcast(GROUP_MESSAGE_EVENT, recipients, payload);

    // Push to offline recipients only.
    const offline = recipients.filter((id) => !this.gateway.isOnline(id));
    await Promise.all(
      offline.map((id) =>
        this.notifications.sendToUser(id, NotificationTypes.NEW_MESSAGE, {
          title: firstName(me.name),
          body: payload.type === 'IMAGE' ? '📷 Фото' : (payload.body ?? ''),
          data: { groupId, deeplink: GROUP_DEEPLINK(groupId) },
        }),
      ),
    );
    return payload;
  }

  private validateMessage(dto: { type: 'TEXT' | 'IMAGE'; body?: string; mediaUrl?: string }): { body: string | null; mediaUrl: string | null } {
    if (dto.type === 'TEXT') {
      const body = dto.body?.trim();
      if (!body) throw new BadRequestException('Повідомлення не може бути порожнім');
      return { body, mediaUrl: null };
    }
    if (!dto.mediaUrl) throw new BadRequestException('mediaUrl is required for image messages');
    return { body: null, mediaUrl: dto.mediaUrl };
  }

  private toGroupView(group: {
    id: string;
    title: string;
    creatorId: string;
    scheduledAt: Date | null;
    createdAt: Date;
    members: Array<GroupMember & { user: { id: string; name: string } }>;
  }) {
    return {
      id: group.id,
      title: group.title,
      creatorId: group.creatorId,
      scheduledAt: group.scheduledAt,
      createdAt: group.createdAt,
      members: group.members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        status: m.status,
        invitedAt: m.invitedAt,
        respondedAt: m.respondedAt,
      })),
    };
  }
}
