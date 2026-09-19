import type { User } from '@prisma/client';

/** User shape safe to return over the wire — never exposes passwordHash. */
export type SafeUser = Omit<User, 'passwordHash'>;

/**
 * Strips passwordHash from a Prisma user row (Part 0 exit criterion:
 * "no passwordHash leak"). Generic so it also covers `User & { gym }` shapes.
 */
export function toSafeUser<T extends { passwordHash?: string | null }>(user: T): Omit<T, 'passwordHash'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _omit, ...safe } = user;
  return safe;
}