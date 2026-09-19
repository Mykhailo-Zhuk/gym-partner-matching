import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { SocialProvider } from '@prisma/client';
import { getFirebaseAuth, isFirebaseConfigured } from '../notifications/firebase';

export interface VerifiedSocialIdentity {
  providerUserId: string;
  email: string;
  name: string;
}

/**
 * Verifies Google/Apple ID tokens. Both go through Sign in with Firebase (apple.com
 * provider needs Apple developer credentials; Firebase covers both with one dependency).
 * Without FCM_SERVICE_ACCOUNT_JSON a dev-only token format is accepted so the flow can be
 * tested locally and in CI: `dev:<uid>:<email>:<name>`. Disabled in production.
 */
@Injectable()
export class SocialVerifier {
  async verify(provider: SocialProvider, idToken: string): Promise<VerifiedSocialIdentity> {
    if (isFirebaseConfigured()) {
      try {
        const decoded = await getFirebaseAuth().verifyIdToken(idToken);
        if (!decoded.email) throw new Error('no email claim');
        return {
          providerUserId: decoded.uid,
          email: decoded.email,
          name: typeof decoded.name === 'string' && decoded.name ? decoded.name : decoded.email.split('@')[0],
        };
      } catch {
        throw new UnauthorizedException('Invalid social ID token');
      }
    }

    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Social sign-in is not configured');
    }
    return this.verifyDevToken(provider, idToken);
  }

  private verifyDevToken(provider: SocialProvider, idToken: string): VerifiedSocialIdentity {
     
    console.warn(`[social-verifier] DEV token accepted for ${provider} (Firebase not configured)`);
    const parts = idToken.split(':');
    if (parts.length !== 4 || parts[0] !== 'dev' || !parts[1] || !parts[2] || !parts[3]) {
      throw new UnauthorizedException('Dev token must look like dev:<uid>:<email>:<name>');
    }
    return { providerUserId: parts[1], email: parts[2], name: parts[3] };
  }
}
