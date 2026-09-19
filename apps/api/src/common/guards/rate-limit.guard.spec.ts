import { HttpException, type ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

const ctxFor = (ip: string): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  }) as unknown as ExecutionContext;

describe('RateLimitGuard (matching preview is rate-limited pre-auth)', () => {
  it('allows up to the limit, then returns 429', () => {
    const guard = new RateLimitGuard(3);
    const ctx = ctxFor('1.2.3.4');

    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);

    try {
      guard.canActivate(ctx);
      fail('expected 429');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(429);
    }
  });

  it('tracks clients independently', () => {
    const guard = new RateLimitGuard(1);
    expect(guard.canActivate(ctxFor('1.1.1.1'))).toBe(true);
    expect(guard.canActivate(ctxFor('2.2.2.2'))).toBe(true); // different IP — allowed
  });

  it('resets the window after expiry', () => {
    jest.useFakeTimers();
    const guard = new RateLimitGuard(1);
    const ctx = ctxFor('9.9.9.9');

    expect(guard.canActivate(ctx)).toBe(true);
    jest.advanceTimersByTime(61_000);
    expect(guard.canActivate(ctx)).toBe(true);
    jest.useRealTimers();
  });
});
