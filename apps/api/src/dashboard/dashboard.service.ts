import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PairGoal } from '@prisma/client';
import { firstName } from '../chat/chat.service';
import { BadgesService, BADGE_RULES } from '../badges/badges.service';
import { assertActive, participantMatch, partnerIdOf } from '../matches/match-access';
import { NotificationTypes, NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateGoalDto } from './dto/create-goal.dto';
import type { CreateWorkoutDto } from './dto/create-workout.dto';
import { goalProgress, streakWeeks, tonnage } from './stats';

/**
 * Story #2 — shared dashboard. Consistency rule: every aggregate is computed
 * here from the same rows, so both partners always read identical numbers.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly badges: BadgesService,
  ) {}

  /** POST /matches/:id/workouts — manual entry; re-checks goal progress on every write. */
  async addWorkout(matchId: string, userId: string, dto: CreateWorkoutDto) {
    const match = await participantMatch(this.prisma, matchId, userId);
    assertActive(match);

    const workout = await this.prisma.workout.create({
      data: {
        matchId,
        userId,
        date: new Date(dto.date),
        type: dto.type,
        sets: dto.sets ?? null,
        reps: dto.reps ?? null,
        weightKg: dto.weightKg ?? null,
      },
    });
    await this.syncGoals(matchId);
    // Part 5 (#10) badge hooks. All idempotent (UNIQUE on user_badges).
    await this.badges.award(userId, BADGE_RULES.FIRST_WORKOUT);
    await this.badges.award(userId, BADGE_RULES.STREAK_4);
    await this.badges.award(userId, BADGE_RULES.TONNAGE_1K, { matchId });
    return workout;
  }

  /** GET /matches/:id/dashboard — calendar entries + aggregates + goals with live progress. */
  async dashboard(matchId: string, userId: string) {
    await participantMatch(this.prisma, matchId, userId); // read stays open for ended matches (history)

    const [workouts, goals] = await Promise.all([
      this.prisma.workout.findMany({
        where: { matchId },
        orderBy: { date: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.pairGoal.findMany({ where: { matchId }, orderBy: { createdAt: 'desc' } }),
    ]);

    return {
      stats: {
        workoutCount: workouts.length,
        totalKg: Math.round(workouts.reduce((sum, w) => sum + tonnage(w), 0)),
        streakWeeks: streakWeeks(workouts.map((w) => w.date)),
      },
      goals: goals.map((g) => this.withProgress(g, workouts)),
      workouts: workouts.map(({ user, ...w }) => ({
        ...w,
        user: { id: user.id, name: firstName(user.name) }, // "who attended" mark
      })),
    };
  }

  /** POST /matches/:id/goals — creates a PENDING_CONFIRM goal; partner gets a push to confirm. */
  async createGoal(matchId: string, userId: string, dto: CreateGoalDto) {
    const match = await participantMatch(this.prisma, matchId, userId);
    assertActive(match);

    const goal = await this.prisma.pairGoal.create({
      data: {
        matchId,
        title: dto.title,
        target: dto.target,
        metric: dto.metric,
        due: dto.due ? new Date(dto.due) : null,
        createdBy: userId,
      },
    });

    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    await this.notifications.sendToUser(partnerIdOf(match, userId), NotificationTypes.GOAL_CONFIRM_REQUEST, {
      title: 'GymBrosUK',
      body: `${firstName(me.name)} пропонує спільну ціль: «${goal.title}»`,
      data: { matchId, goalId: goal.id, deeplink: `gymbros://matches/${matchId}/dashboard` },
    });
    return this.withProgress(goal, await this.matchWorkouts(matchId));
  }

  /** POST /matches/:id/goals/:goalId/confirm — only the partner (not the creator) confirms. */
  async confirmGoal(matchId: string, goalId: string, userId: string) {
    const match = await participantMatch(this.prisma, matchId, userId);
    assertActive(match);

    const goal = await this.prisma.pairGoal.findUnique({ where: { id: goalId } });
    if (!goal || goal.matchId !== matchId) throw new NotFoundException('Goal not found');
    if (goal.createdBy === userId) throw new ConflictException('Ціль має підтвердити напарник');
    if (goal.status !== 'PENDING_CONFIRM') throw new ConflictException('Ціль вже підтверджено');

    const updated = await this.prisma.pairGoal.update({ where: { id: goalId }, data: { status: 'ACTIVE' } });
    return this.withProgress(updated, await this.matchWorkouts(matchId));
  }

  /** Flip ACTIVE goals to DONE once progress hits the target; push both partners once. */
  private async syncGoals(matchId: string): Promise<void> {
    const goals = await this.prisma.pairGoal.findMany({ where: { matchId, status: 'ACTIVE' } });
    if (goals.length === 0) return;

    const workouts = await this.matchWorkouts(matchId);
    for (const goal of goals) {
      if (goalProgress(goal, workouts) < goal.target) continue;
      // Atomic claim: only the writer that flips ACTIVE->DONE sends the push (no duplicates).
      const { count } = await this.prisma.pairGoal.updateMany({
        where: { id: goal.id, status: 'ACTIVE' },
        data: { status: 'DONE' },
      });
      if (count === 1) {
        const match = await this.prisma.match.findUniqueOrThrow({ where: { id: matchId } });
        await this.notifications.sendToUsers([match.userAId, match.userBId], NotificationTypes.GOAL_COMPLETED, {
          title: 'GymBrosUK',
          body: `Ціль виконано! 🎉 «${goal.title}»`,
          data: { matchId, goalId: goal.id, deeplink: `gymbros://matches/${matchId}/dashboard` },
        });
      }
    }
  }

  private matchWorkouts(matchId: string) {
    return this.prisma.workout.findMany({ where: { matchId } });
  }

  private withProgress(goal: PairGoal, workouts: { date: Date; sets: number | null; reps: number | null; weightKg: number | null }[]) {
    return { ...goal, progress: goalProgress(goal, workouts) };
  }
}
