import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Match, Message, Prisma } from '@prisma/client';
import { NotificationTypes, NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from './chat.gateway';
import { SendMessageType, type SendMessageDto } from './dto/send-message.dto';

export const CHAT_INACTIVE_MESSAGE = 'Чат доступний тільки для активних матчів';

/** Wire format shared by REST responses and the `message:new` socket event. */
export interface ChatMessagePayload {
  id: string;
  matchId: string;
  senderId: string | null;
  senderName: string | null; // null for SYSTEM messages
  type: 'TEXT' | 'IMAGE' | 'SYSTEM';
  body: string | null;
  mediaUrl: string | null;
  createdAt: string; // ISO
}

export interface MessagePage {
  items: ChatMessagePayload[]; // ascending (oldest first)
  nextCursor: string | null; // pass as ?before= to fetch older page
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] || 'Користувач';

/**
 * Chat access rule (story #7): only participants of an ACTIVE match.
 * 404 for non-participants (don't leak match existence); 403 with the exact
 * Gherkin message for participants of an inactive match.
 */
export async function fetchChatMatch(prisma: PrismaService, matchId: string, userId: string): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || (match.userAId !== userId && match.userBId !== userId)) {
    throw new NotFoundException('Match not found');
  }
  if (match.status !== 'ACTIVE') {
    throw new ForbiddenException({ statusCode: 403, code: 'CHAT_INACTIVE', message: CHAT_INACTIVE_MESSAGE });
  }
  return match;
}

export function toPayload(message: Message, senderName: string | null): ChatMessagePayload {
  return {
    id: message.id,
    matchId: message.matchId,
    senderId: message.senderId,
    senderName,
    type: message.type,
    body: message.body,
    mediaUrl: message.mediaUrl,
    createdAt: message.createdAt.toISOString(),
  };
}

const chatDeeplink = (matchId: string) => `gymbros://matches/${matchId}/chat`;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ChatGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /** GET /matches/:id/messages?before= — keyset pagination (cursor = message id). */
  async listMessages(userId: string, matchId: string, before: string | undefined, limit: number): Promise<MessagePage> {
    await fetchChatMatch(this.prisma, matchId, userId);

    let cursorFilter: Prisma.MessageWhereInput | undefined;
    if (before) {
      const cursor = await this.prisma.message.findFirst({ where: { id: before, matchId } });
      if (!cursor) throw new BadRequestException('Invalid cursor');
      cursorFilter = {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      };
    }

    const rows = await this.prisma.message.findMany({
      where: { matchId, ...cursorFilter },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { sender: { select: { name: true } } },
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse(); // ascending for the UI
    return {
      items: page.map((m) => toPayload(m, m.sender ? firstName(m.sender.name) : null)),
      nextCursor: hasMore ? page[0].id : null,
    };
  }

  /**
   * POST /matches/:id/messages — persist, then realtime fanout to both
   * participants; if the recipient has no live socket, FCM push (story AC:
   * "push fires when app is backgrounded").
   */
  async createMessage(userId: string, matchId: string, dto: SendMessageDto): Promise<ChatMessagePayload> {
    const match = await fetchChatMatch(this.prisma, matchId, userId);
    const { body, mediaUrl } = this.validate(dto);

    // Create the message and read the sender's name concurrently — both are
    // independent DB round-trips, so serializing them only adds latency to
    // the hot "send message" path.
    const [message, sender] = await Promise.all([
      this.prisma.message.create({
        data: { matchId, senderId: userId, type: dto.type, body, mediaUrl },
      }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }),
    ]);
    const senderName = firstName(sender.name);
    const payload = toPayload(message, senderName);

    this.gateway.broadcastToUsers([match.userAId, match.userBId], payload);

    const recipientId = match.userAId === userId ? match.userBId : match.userAId;
    if (!this.gateway.isOnline(recipientId)) {
      await this.notifications.sendToUser(recipientId, NotificationTypes.NEW_MESSAGE, {
        title: senderName,
        body: payload.type === 'IMAGE' ? '📷 Фото' : (payload.body ?? ''),
        data: { matchId, deeplink: chatDeeplink(matchId) },
      });
    }
    return payload;
  }

  /** System message (e.g. story #4 "Дмитро в дорозі 🚗") — server-side only. */
  async createSystemMessage(matchId: string, body: string): Promise<ChatMessagePayload> {
    const match = await this.prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    const message = await this.prisma.message.create({
      data: { matchId, type: 'SYSTEM', body },
    });
    const payload = toPayload(message, null);
    this.gateway.broadcastToUsers([match.userAId, match.userBId], payload);
    return payload;
  }

  private validate(dto: SendMessageDto): { body: string | null; mediaUrl: string | null } {
    if (dto.type === SendMessageType.TEXT) {
      const body = dto.body?.trim();
      if (!body) throw new BadRequestException('Повідомлення не може бути порожнім');
      return { body, mediaUrl: null };
    }
    // IMAGE via the Part 0 upload pipeline: presign -> PUT to S3 -> send fileUrl here.
    if (!dto.mediaUrl) throw new BadRequestException('mediaUrl is required for image messages');
    const endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9100';
    const bucket = process.env.S3_BUCKET ?? 'gymbros-uploads';
    if (!dto.mediaUrl.startsWith(`${endpoint}/${bucket}/chat/`)) {
      throw new BadRequestException('mediaUrl must come from POST /uploads/presign (kind=chat)');
    }
    return { body: dto.caption?.trim() || null, mediaUrl: dto.mediaUrl };
  }
}
