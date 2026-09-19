import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Match } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/** Shared match access rules (Part 3+4): participants only, writes only while ACTIVE. */
export async function participantMatch(prisma: PrismaService, matchId: string, userId: string): Promise<Match> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || (match.userAId !== userId && match.userBId !== userId)) {
    throw new NotFoundException('Match not found');
  }
  return match;
}

export function assertActive(match: Match): void {
  if (match.status !== 'ACTIVE') {
    throw new ConflictException({ statusCode: 409, code: 'MATCH_INACTIVE', message: 'Матч не активний' });
  }
}

export function partnerIdOf(match: Match, userId: string): string {
  return match.userAId === userId ? match.userBId : match.userAId;
}
