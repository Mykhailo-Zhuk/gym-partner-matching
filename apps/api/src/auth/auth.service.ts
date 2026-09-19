import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { SocialProvider } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralsService } from '../referrals/referrals.service';
import { toSafeUser, type SafeUser } from '../common/safe-user';
import type { RegisterDto } from './dto/register.dto';
import type { SocialAuthDto } from './dto/social-auth.dto';
import { SocialVerifier } from './social-verifier';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const BLOCKED_RESPONSE = {
  statusCode: 403,
  code: 'ACCOUNT_BLOCKED',
  message: 'Обліковий запис заблоковано. Зверніться до підтримки.',
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly social: SocialVerifier,
    private readonly referrals: ReferralsService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    if (dto.gymId) await this.assertGymExists(dto.gymId);
    if (dto.referralCode) {
      // Validate the code BEFORE creating the user so an invalid code returns 400
      // with no orphan account (Gherkin: "Код не знайдено").
      await this.referrals.assertCodeValid(dto.referralCode);
    }
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email is already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        goal: dto.goal,
        level: dto.level,
        gymId: dto.gymId,
      },
    });
    if (dto.referralCode) {
      // Already validated above — the only race is the (rare) case where the
      // referrer deletes their code between the assert and the apply, which is
      // caught and surfaced as the same Gherkin 400.
      await this.referrals.applyCode(user.id, dto.referralCode, { strict: true });
    }
    return { user: toSafeUser(user), tokens: await this.issueTokens(user) };
  }

  async login(email: string, password: string): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user?.passwordHash) throw new UnauthorizedException('Invalid email or password');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');
    if (user.status === 'BLOCKED') throw new ForbiddenException(BLOCKED_RESPONSE);
    return { user: toSafeUser(user), tokens: await this.issueTokens(user) };
  }

  async socialLogin(dto: SocialAuthDto): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const identity = await this.social.verify(dto.provider, dto.idToken);
    const email = identity.email.toLowerCase();

    const account = await this.prisma.socialAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: dto.provider as SocialProvider,
          providerUserId: identity.providerUserId,
        },
      },
      include: { user: true },
    });

    let user: User;
    if (account) {
      user = account.user;
    } else {
      if (dto.gymId) await this.assertGymExists(dto.gymId);
      // Link to an existing account with the same email, otherwise create a new user.
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      user =
        byEmail ??
        (await this.prisma.user.create({
          data: { email, name: identity.name, goal: dto.goal, level: dto.level, gymId: dto.gymId },
        }));
      await this.prisma.socialAccount.create({
        data: { provider: dto.provider as SocialProvider, providerUserId: identity.providerUserId, userId: user.id },
      });
    }

    if (user.status === 'BLOCKED') throw new ForbiddenException(BLOCKED_RESPONSE);
    if (dto.referralCode) {
      // New social account: bad code is silently ignored.
      await this.referrals.applyCode(user.id, dto.referralCode, { strict: false });
    }
    return { user: toSafeUser(user), tokens: await this.issueTokens(user) };
  }

  /** Refresh-token rotation: the presented token is revoked, a fresh pair is issued. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
    if (stored.user.status === 'BLOCKED') throw new ForbiddenException(BLOCKED_RESPONSE);

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(stored.user);
  }

  /** Current-user profile for GET /auth/me (never exposes passwordHash). */
  async me(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return toSafeUser(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Used by admin block: kills every session so access is revoked immediately. */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async issueTokens(user: Pick<User, 'id' | 'role'>): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access',
        expiresIn: Number(process.env.JWT_ACCESS_TTL ?? 900),
      },
    );
    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + Number(process.env.JWT_REFRESH_TTL ?? 2_592_000) * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  private async assertGymExists(gymId: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) throw new ConflictException(`Unknown gymId: ${gymId}`);
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
