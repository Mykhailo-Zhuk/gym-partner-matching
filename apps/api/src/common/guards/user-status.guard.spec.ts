import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { UserStatusGuard } from './user-status.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const ctxWith = (user?: { id: string; role: string }): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('UserStatusGuard (blocked users fail fast everywhere)', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const guard = new UserStatusGuard(prisma as never, reflector as never);

  beforeEach(() => jest.clearAllMocks());

  it('skips @Public() routes without hitting the DB', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true); // IS_PUBLIC_KEY
    await expect(guard.canActivate(ctxWith())).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.anything());
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    await expect(guard.canActivate(ctxWith())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lets ACTIVE users through', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ status: 'ACTIVE' });
    await expect(guard.canActivate(ctxWith({ id: 'u1', role: 'USER' }))).resolves.toBe(true);
  });

  it('rejects BLOCKED users with 403 ACCOUNT_BLOCKED', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ status: 'BLOCKED' });
    await expect(guard.canActivate(ctxWith({ id: 'u1', role: 'USER' }))).rejects.toMatchObject({
      constructor: ForbiddenException,
      response: { code: 'ACCOUNT_BLOCKED' },
    });
  });

  it('rejects when the user row vanished (e.g. deleted account)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(guard.canActivate(ctxWith({ id: 'gone', role: 'USER' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
