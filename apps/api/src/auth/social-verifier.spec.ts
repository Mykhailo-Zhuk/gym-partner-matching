import { UnauthorizedException } from '@nestjs/common';
import { SocialVerifier } from './social-verifier';

// Firebase is intentionally NOT configured in unit tests (no FCM_SERVICE_ACCOUNT_JSON),
// so the verifier must use the documented dev-token path.
describe('SocialVerifier (dev token path)', () => {
  const verifier = new SocialVerifier();
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('parses a valid dev token', async () => {
    const identity = await verifier.verify('GOOGLE', 'dev:uid123:ivan@example.com:Іван');
    expect(identity).toEqual({
      providerUserId: 'uid123',
      email: 'ivan@example.com',
      name: 'Іван',
    });
  });

  it('rejects malformed dev tokens', async () => {
    await expect(verifier.verify('GOOGLE', 'not-a-dev-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(verifier.verify('APPLE', 'dev:only-two')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('is disabled in production when Firebase is not configured', async () => {
    process.env.NODE_ENV = 'production';
    await expect(verifier.verify('GOOGLE', 'dev:u:e@x.com:n')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
