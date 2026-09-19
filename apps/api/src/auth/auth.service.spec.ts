import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, hashToken } from './auth.service';
import type { SocialVerifier } from './social-verifier';

function mockUser(overrides: Partial<{ id: string; email: string; name: string; passwordHash: string | null; status: string; role: string }> = {}) {
  return {
    id: 'u-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    status: 'ACTIVE',
    passwordHash: null,
    ...overrides,
  };
}

describe('AuthService (unit)', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    socialAccount: { create: jest.fn(), findUnique: jest.fn() },
    gym: { findUnique: jest.fn() },
  };
  const jwt = {
    signAsync: jest.fn().mockResolvedValue('signed-access-token'),
  } as unknown as JwtService;
  const social = { verify: jest.fn() } as unknown as SocialVerifier;
  const referrals = { applyCode: jest.fn().mockResolvedValue({ applied: false }), assertCodeValid: jest.fn() };
  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    // Re-apply fresh mocks after reset
    jwt.signAsync = jest.fn().mockResolvedValue('signed-access-token');
    social.verify = jest.fn().mockResolvedValue({
      providerUserId: 'google-123',
      email: 'social@example.com',
      name: 'Social User',
    });
    referrals.applyCode = jest.fn().mockResolvedValue({ applied: false });
    referrals.assertCodeValid = jest.fn();
    service = new AuthService(prisma as unknown as PrismaService, jwt, social, referrals as never);
  });

  // ─── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('normalises email to lowercase', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        mockUser({ email: data.email as string, ...data }),
      );
      prisma.refreshToken.create.mockResolvedValue({});

      const { user } = await service.register({ email: 'NEW@Example.COM', password: 'pw', name: 'N' });

      expect(user.email).toBe('new@example.com');
    });

    it('rejects duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());

      await expect(service.register({ email: 'a@b.com', password: 'pw', name: 'N' })).rejects.toThrow(ConflictException);
    });

    it('validates gymId before creating the user', async () => {
      prisma.gym.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.register({ email: 'a@b.com', password: 'pw', name: 'N', gymId: 'bad-gym' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('calls referrals.assertCodeValid before creating the user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        mockUser({ email: data.email as string, ...data }),
      );
      prisma.refreshToken.create.mockResolvedValue({});

      await service.register({ email: 'a@b.com', password: 'pw', name: 'N', referralCode: 'GYM123' });

      expect(referrals.assertCodeValid).toHaveBeenCalledWith('GYM123');
    });

    it('calls referrals.applyCode after creating the user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        mockUser({ id: 'new-user', email: data.email as string, ...data }),
      );
      prisma.refreshToken.create.mockResolvedValue({});

      await service.register({ email: 'a@b.com', password: 'pw', name: 'N', referralCode: 'GYM123' });

      expect(referrals.applyCode).toHaveBeenCalledWith('new-user', 'GYM123', { strict: true });
    });

    it('does not call referrals when no code is provided', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        mockUser({ email: data.email as string, ...data }),
      );
      prisma.refreshToken.create.mockResolvedValue({});

      await service.register({ email: 'a@b.com', password: 'pw', name: 'N' });

      expect(referrals.applyCode).not.toHaveBeenCalled();
      expect(referrals.assertCodeValid).not.toHaveBeenCalled();
    });

    it('issues tokens with the new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        mockUser({ email: data.email as string, ...data }),
      );
      prisma.refreshToken.create.mockResolvedValue({});

      const { tokens, user } = await service.register({ email: 'a@b.com', password: 'pw', name: 'N' });

      expect(tokens.accessToken).toBe('signed-access-token');
      expect(tokens.refreshToken).toHaveLength(96);
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login('nobody@test.com', 'pw')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser(), passwordHash: await bcrypt.hash('correct', 10) });

      await expect(service.login('test@test.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when user is BLOCKED', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser(), passwordHash: hash, status: 'BLOCKED' });

      await expect(service.login('test@test.com', 'correct')).rejects.toThrow(ForbiddenException);
    });

    it('returns user + tokens on success', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue(mockUser({ passwordHash: hash }));
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login('test@test.com', 'correct');

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.accessToken).toBe('signed-access-token');
    });
  });

  // ─── socialLogin ────────────────────────────────────────────────────────

  describe('socialLogin', () => {
    const identity = {
      providerUserId: 'google-123',
      email: 'social@example.com',
      name: 'Social User',
    } as const;

    it('links to existing social account and returns user + tokens', async () => {
      const existingUser = mockUser({ email: 'social@example.com' });
      prisma.socialAccount.findUnique.mockResolvedValue({ id: 'sa1', user: existingUser } as never);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.socialLogin({ provider: 'GOOGLE', idToken: 'token', goal: 'MASS' });

      expect(result.user.email).toBe('social@example.com');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates new user when no social account exists and email is new', async () => {
      prisma.socialAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        mockUser({ email: data.email as string, name: data.name as string, ...data }),
      );
      prisma.socialAccount.create.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.socialLogin({ provider: 'GOOGLE', idToken: 'token', goal: 'MASS' });

      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.socialAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ provider: 'GOOGLE', providerUserId: 'google-123' }),
      });
    });

    it('links to existing email account when no social account matches', async () => {
      const existingUser = mockUser({ email: 'social@example.com' });
      prisma.socialAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.socialAccount.create.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.socialLogin({ provider: 'GOOGLE', idToken: 'token', goal: 'MASS' });

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.user.email).toBe('social@example.com');
    });

    it('applies referral code in non-strict mode for social login', async () => {
      const existingUser = mockUser({ email: 'social@example.com' });
      prisma.socialAccount.findUnique.mockResolvedValue({ id: 'sa1', user: existingUser } as never);
      prisma.refreshToken.create.mockResolvedValue({});

      await service.socialLogin({ provider: 'GOOGLE', idToken: 'token', goal: 'MASS', referralCode: 'GYM123' });

      expect(referrals.applyCode).toHaveBeenCalledWith(existingUser.id, 'GYM123', { strict: false });
    });

    it('throws ForbiddenException when linked user is BLOCKED', async () => {
      const blockedUser = mockUser({ email: 'social@example.com', status: 'BLOCKED' });
      prisma.socialAccount.findUnique.mockResolvedValue({ id: 'sa1', user: blockedUser } as never);

      await expect(service.socialLogin({ provider: 'GOOGLE', idToken: 'token', goal: 'MASS' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── refresh ─────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('throws UnauthorizedException for invalid token', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for revoked token', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        tokenHash: 'hash',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        user: mockUser(),
      });

      await expect(service.refresh('revoked-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for expired token', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        tokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60_000), // already expired
        user: mockUser(),
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when user is BLOCKED', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        tokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: { ...mockUser(), status: 'BLOCKED' },
      });

      await expect(service.refresh('good-token')).rejects.toThrow(ForbiddenException);
    });

    it('revokes the old token and issues new ones on success', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        tokenHash: 'hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: mockUser(),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const tokens = await service.refresh('valid-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(tokens.accessToken).toBe('signed-access-token');
    });
  });

  // ─── logout ─────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes the presented refresh token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('some-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: hashToken('some-token'), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  // ─── revokeAllUserTokens ────────────────────────────────────────────────

  describe('revokeAllUserTokens', () => {
    it('revokes all non-revoked tokens for the user', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.revokeAllUserTokens('u-1');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  // ─── me ────────────────────────────────────────────────────────────────

  describe('me', () => {
    it('returns the safe user for the given id', async () => {
      const user = mockUser({ email: 'me@test.com' });
      prisma.user.findUniqueOrThrow.mockResolvedValue(user);

      const result = await service.me('u-1');

      expect(result.email).toBe('me@test.com');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
