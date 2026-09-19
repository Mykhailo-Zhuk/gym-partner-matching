import { JwtService } from '@nestjs/jwt';
import { ChatGateway, CHAT_MESSAGE_EVENT } from './chat.gateway';

/**
 * Unit tests for ChatGateway.
 * The gateway's core logic is the in-memory "online" map + auth checks.
 * Socket.io-typed objects are mocked via plain record types to avoid type conflicts.
 */

function makeSocket(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    handshake: { auth: {} },
    data: {},
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ChatGateway (unit)', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  const jwt = { verifyAsync: jest.fn() };
  let gateway: ChatGateway;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockServer: any;

  beforeEach(() => {
    jest.resetAllMocks();
    jwt.verifyAsync.mockReset();
    prisma.user.findUnique.mockReset();

    // Default success mocks — individual tests override as needed
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1' });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', status: 'ACTIVE' });

    gateway = new ChatGateway(jwt as unknown as JwtService, prisma as unknown as never);

    mockServer = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      in: jest.fn().mockReturnValue({ disconnectSockets: jest.fn().mockResolvedValue(undefined) }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (gateway as any).server = mockServer;
  });

  // ─── handleConnection ────────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('disconnects when no token is provided', async () => {
      const client = makeSocket({ handshake: { auth: {} } });

      await gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects when the token is a non-string', async () => {
      const client = makeSocket({ handshake: { auth: { token: 123 } } });

      await gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects when JWT verification fails', async () => {
      const client = makeSocket({ handshake: { auth: { token: 'bad' } } });
      jwt.verifyAsync.mockRejectedValue(new Error('invalid'));

      await gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects when the user is not found', async () => {
      const client = makeSocket({ handshake: { auth: { token: 'valid' } } });
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1' });
      prisma.user.findUnique.mockResolvedValue(null);

      await gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects when the user status is not ACTIVE', async () => {
      const client = makeSocket({ handshake: { auth: { token: 'valid' } } });
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', status: 'SUSPENDED' });

      await gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('stores userId in socket data on success', async () => {
      const client = makeSocket({ handshake: { auth: { token: 'valid' } } });

      await gateway.handleConnection(client as never);

      expect((client as any).data.userId).toBe('u1');
    });

    it('calls join with the user room on success', async () => {
      const client = makeSocket({ handshake: { auth: { token: 'valid' } } });

      await gateway.handleConnection(client as never);

      expect(client.join).toHaveBeenCalledWith('user:u1');
    });
  });

  // ─── handleDisconnect ──────────────────────────────────────────────────

  describe('handleDisconnect', () => {
    it('does nothing when socket has no userId in data', () => {
      const client = { data: {} } as never;
      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });

    it('removes the user from the online map', async () => {
      const client = makeSocket({ handshake: { auth: { token: 'token' } } });
      await gateway.handleConnection(client as never);

      gateway.handleDisconnect(client as never);

      expect(gateway.isOnline('u1')).toBe(false);
    });
  });

  // ─── isOnline ──────────────────────────────────────────────────────────

  describe('isOnline', () => {
    it('returns false for a user that never connected', () => {
      expect(gateway.isOnline('u1')).toBe(false);
    });

    it('returns true for a connected user', async () => {
      const client = makeSocket({ handshake: { auth: { token: 'token' } } });
      await gateway.handleConnection(client as never);

      expect(gateway.isOnline('u1')).toBe(true);
    });

    it('returns false after the user disconnects', async () => {
      const client = makeSocket({ handshake: { auth: { token: 'token' } } });
      await gateway.handleConnection(client as never);
      gateway.handleDisconnect(client as never);

      expect(gateway.isOnline('u1')).toBe(false);
    });
  });

  // ─── broadcastToUsers ───────────────────────────────────────────────────

  describe('broadcastToUsers', () => {
    it('emits CHAT_MESSAGE_EVENT to each user room', () => {
      const emit = jest.fn();
      mockServer.to.mockReturnValue({ emit });

      gateway.broadcastToUsers(['u1', 'u2'], {
        id: 'msg1', matchId: 'm1', senderId: 'u1', type: 'TEXT', body: 'hello',
        createdAt: new Date().toISOString(), senderName: 'User', mediaUrl: null,
      });

      // server.to is called once with all rooms at once
      expect(mockServer.to).toHaveBeenCalledWith(['user:u1', 'user:u2']);
      expect(emit).toHaveBeenCalledWith(CHAT_MESSAGE_EVENT, expect.objectContaining({ body: 'hello' }));
    });

    it('does not throw when server is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (gateway as any).server = undefined;
      expect(() => gateway.broadcastToUsers(['u1'], {
        id: 'msg1', matchId: 'm1', senderId: 'u1', type: 'TEXT', body: 'hi',
        createdAt: new Date().toISOString(), senderName: 'User', mediaUrl: null,
      })).not.toThrow();
    });
  });

  // ─── broadcast ─────────────────────────────────────────────────────────

  describe('broadcast', () => {
    it('emits the given event to each user room', () => {
      const emit = jest.fn();
      mockServer.to.mockReturnValue({ emit });

      gateway.broadcast('group:message', ['u1', 'u2'], { text: 'hello' });

      expect(mockServer.to).toHaveBeenCalledWith(['user:u1', 'user:u2']);
      expect(emit).toHaveBeenCalledWith('group:message', { text: 'hello' });
    });
  });

  // ─── disconnectUser ─────────────────────────────────────────────────────

  describe('disconnectUser', () => {
    it('removes the user from the online map', async () => {
      const client = makeSocket({ handshake: { auth: { token: 'token' } } });
      await gateway.handleConnection(client as never);

      await gateway.disconnectUser('u1');

      expect(gateway.isOnline('u1')).toBe(false);
    });

    it('calls disconnectSockets on the user room', async () => {
      const disconnectSockets = jest.fn().mockResolvedValue(undefined);
      mockServer.in.mockReturnValue({ disconnectSockets });

      await gateway.disconnectUser('u1');

      expect(mockServer.in).toHaveBeenCalledWith('user:u1');
      expect(disconnectSockets).toHaveBeenCalledWith(true);
    });
  });
});
