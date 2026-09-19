import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from './chat.gateway';
import { CHAT_INACTIVE_MESSAGE, ChatService, fetchChatMatch } from './chat.service';
import { SendMessageType } from './dto/send-message.dto';

const ACTIVE_MATCH = { id: 'm1', userAId: 'u1', userBId: 'u2', status: 'ACTIVE' };

describe('fetchChatMatch — access rule (story #7)', () => {
  const prisma = { match: { findUnique: jest.fn() } };

  beforeEach(() => jest.clearAllMocks());

  it('404s for non-participants (no match-existence leak)', async () => {
    prisma.match.findUnique.mockResolvedValue(ACTIVE_MATCH);
    await expect(fetchChatMatch(prisma as unknown as PrismaService, 'm1', 'stranger')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('403s with the exact Gherkin message for non-ACTIVE matches', async () => {
    prisma.match.findUnique.mockResolvedValue({ ...ACTIVE_MATCH, status: 'ENDED' });
    const error = await fetchChatMatch(prisma as unknown as PrismaService, 'm1', 'u1').catch((e) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).message).toBe(CHAT_INACTIVE_MESSAGE);
  });

  it('returns the match for ACTIVE participants', async () => {
    prisma.match.findUnique.mockResolvedValue(ACTIVE_MATCH);
    await expect(fetchChatMatch(prisma as unknown as PrismaService, 'm1', 'u2')).resolves.toEqual(ACTIVE_MATCH);
  });
});

describe('ChatService (unit)', () => {
  const prisma = {
    match: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    message: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    user: { findUniqueOrThrow: jest.fn() },
  };
  const gateway = { broadcastToUsers: jest.fn(), isOnline: jest.fn() };
  const notifications = { sendToUser: jest.fn() };
  const service = new ChatService(
    prisma as unknown as PrismaService,
    gateway as unknown as ChatGateway,
    notifications as unknown as NotificationsService,
  );

  const createdMessage = (overrides: object = {}) => ({
    id: 'msg1',
    matchId: 'm1',
    senderId: 'u1',
    type: 'TEXT',
    body: 'До зустрічі!',
    mediaUrl: null,
    createdAt: new Date('2026-08-23T18:00:00Z'),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.match.findUnique.mockResolvedValue(ACTIVE_MATCH);
    prisma.user.findUniqueOrThrow.mockResolvedValue({ name: 'Дмитро Савченко' });
    gateway.isOnline.mockReturnValue(false);
  });

  it('TEXT: persists trimmed body and fans out to BOTH participants (multi-device sender sync)', async () => {
    prisma.message.create.mockResolvedValue(createdMessage());

    const payload = await service.createMessage('u1', 'm1', { type: SendMessageType.TEXT, body: '  До зустрічі!  ' });

    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { matchId: 'm1', senderId: 'u1', type: 'TEXT', body: 'До зустрічі!', mediaUrl: null },
    });
    expect(gateway.broadcastToUsers).toHaveBeenCalledWith(['u1', 'u2'], expect.objectContaining({ body: 'До зустрічі!' }));
    expect(payload.senderName).toBe('Дмитро');
  });

  it('offline recipient => NEW_MESSAGE push that deep-links into the chat', async () => {
    prisma.message.create.mockResolvedValue(createdMessage({ body: 'Привіт!' }));

    await service.createMessage('u1', 'm1', { type: SendMessageType.TEXT, body: 'Привіт!' });

    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'u2',
      'NEW_MESSAGE',
      expect.objectContaining({
        title: 'Дмитро',
        body: 'Привіт!',
        data: { matchId: 'm1', deeplink: 'gymbros://matches/m1/chat' },
      }),
    );
  });

  it('online recipient => realtime only, no push', async () => {
    prisma.message.create.mockResolvedValue(createdMessage());
    gateway.isOnline.mockReturnValue(true);

    await service.createMessage('u1', 'm1', { type: SendMessageType.TEXT, body: 'Привіт!' });

    expect(notifications.sendToUser).not.toHaveBeenCalled();
  });

  it('empty TEXT => 400, nothing persisted', async () => {
    await expect(service.createMessage('u1', 'm1', { type: SendMessageType.TEXT, body: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('IMAGE: rejects URLs that did not come from the upload pipeline', async () => {
    await expect(
      service.createMessage('u1', 'm1', { type: SendMessageType.IMAGE, mediaUrl: 'https://evil.example/x.jpg' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('IMAGE: accepts presigned chat URLs; offline push body is "📷 Фото"', async () => {
    const url = 'http://localhost:9100/gymbros-uploads/chat/u1/photo.jpg';
    prisma.message.create.mockResolvedValue(createdMessage({ type: 'IMAGE', body: null, mediaUrl: url }));

    const payload = await service.createMessage('u1', 'm1', { type: SendMessageType.IMAGE, mediaUrl: url });

    expect(payload.mediaUrl).toBe(url);
    expect(notifications.sendToUser).toHaveBeenCalledWith(
      'u2',
      'NEW_MESSAGE',
      expect.objectContaining({ body: '📷 Фото' }),
    );
  });

  it('system message: senderId null, broadcast to participants', async () => {
    prisma.match.findUniqueOrThrow.mockResolvedValue(ACTIVE_MATCH);
    prisma.message.create.mockResolvedValue(
      createdMessage({ senderId: null, type: 'SYSTEM', body: 'Дмитро в дорозі 🚗' }),
    );

    await service.createSystemMessage('m1', 'Дмитро в дорозі 🚗');

    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { matchId: 'm1', type: 'SYSTEM', body: 'Дмитро в дорозі 🚗' },
    });
    expect(gateway.broadcastToUsers).toHaveBeenCalledWith(['u1', 'u2'], expect.objectContaining({ senderId: null }));
  });

  it('history pagination: returns nextCursor when more pages exist, ascending items', async () => {
    const row = (id: string, hour: number) => ({
      id,
      matchId: 'm1',
      senderId: 'u1',
      type: 'TEXT',
      body: `m${id}`,
      mediaUrl: null,
      createdAt: new Date(`2026-08-23T${String(hour).padStart(2, '0')}:00:00Z`),
      sender: { name: 'Дмитро Савченко' },
    });
    // limit=2, DB returns limit+1 rows (desc) to detect "has more"
    prisma.message.findMany.mockResolvedValue([row('c', 20), row('b', 19), row('a', 18)]);

    const page = await service.listMessages('u1', 'm1', undefined, 2);

    expect(page.items.map((m) => m.id)).toEqual(['b', 'c']); // ascending for the UI
    expect(page.nextCursor).toBe('b'); // fetch older messages with ?before=b
  });

  it('history pagination: ?before= applies a keyset filter on (createdAt, id)', async () => {
    const cursorDate = new Date('2026-08-23T19:00:00Z');
    prisma.match.findUnique.mockResolvedValue(ACTIVE_MATCH);
    prisma.message.findFirst.mockResolvedValue({ id: 'b', createdAt: cursorDate });
    prisma.message.findMany.mockResolvedValue([]);

    const page = await service.listMessages('u1', 'm1', 'b', 50);

    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          matchId: 'm1',
          OR: [{ createdAt: { lt: cursorDate } }, { createdAt: cursorDate, id: { lt: 'b' } }],
        },
      }),
    );
    expect(page.nextCursor).toBeNull();
  });
});
