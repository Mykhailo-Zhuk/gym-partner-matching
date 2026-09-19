import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthUser } from '../decorators/current-user.decorator';

/**
 * Part 0 "UserGuard" — cross-cutting rule #3: a blocked user must fail fast
 * in EVERY endpoint. Runs globally after JwtAuthGuard; @Public() routes skip it.
 */
@Injectable()
export class UserStatusGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const authUser = request.user;
    if (!authUser) throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: authUser.id },
      select: { status: true },
    });
    if (!user) throw new UnauthorizedException('Account no longer exists');
    if (user.status === 'BLOCKED') {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'ACCOUNT_BLOCKED',
        message: 'Обліковий запис заблоковано. Зверніться до підтримки.',
      });
    }
    return true;
  }
}
