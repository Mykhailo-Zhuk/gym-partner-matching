import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import type { ChatMessagePayload } from './chat.service';

export const CHAT_MESSAGE_EVENT = 'message:new';

const userRoom = (userId: string) => `user:${userId}`;

/**
 * Story #7 realtime transport (Socket.io per DoR #9).
 * Sockets are RECEIVE-only: sending goes through REST (POST /matches/:id/messages)
 * for reliability; the gateway fans out persisted messages to both participants.
 * Requirement: delivery <=2s — in-process fanout is effectively instant.
 *
 * Blocked users lose chat immediately: status is re-checked on connect, and
 * AdminService calls disconnectUser() the moment a block lands.
 */
@WebSocketGateway({ namespace: '/chat', cors: { origin: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  private server!: Server;

  /** userId -> open socket count (a user may have several devices). */
  private readonly online = new Map<string, number>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = (client.handshake.auth as Record<string, unknown>).token;
      if (typeof token !== 'string' || !token) throw new UnauthorizedException();

      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access',
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, status: true },
      });
      if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException();

      client.data.userId = user.id;
      await client.join(userRoom(user.id));
      this.online.set(user.id, (this.online.get(user.id) ?? 0) + 1);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    const count = (this.online.get(userId) ?? 1) - 1;
    if (count <= 0) this.online.delete(userId);
    else this.online.set(userId, count);
  }

  /** Recipient online => realtime only; offline => REST layer sends FCM push. */
  isOnline(userId: string): boolean {
    return (this.online.get(userId) ?? 0) > 0;
  }

  broadcastToUsers(userIds: string[], payload: ChatMessagePayload): void {
    if (!this.server) return;
    this.server.to(userIds.map(userRoom)).emit(CHAT_MESSAGE_EVENT, payload);
  }

  /** Generic fanout — used by the group chat with a group-shaped payload. */
  broadcast<T>(event: string, userIds: string[], payload: T): void {
    if (!this.server) return;
    this.server.to(userIds.map(userRoom)).emit(event, payload);
  }

  /** Kill every live socket of a user (called when an admin blocks them). */
  async disconnectUser(userId: string): Promise<void> {
    this.online.delete(userId);
    if (!this.server) return;
    try {
      await this.server.in(userRoom(userId)).disconnectSockets(true);
    } catch (error) {
      this.logger.warn(`Failed to disconnect sockets for user ${userId}`, error as Error);
    }
  }
}
