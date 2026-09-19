import type { GoalMetric } from '@prisma/client';

export interface WorkoutLike {
  date: Date;
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
}

/** Lifted volume of one workout, kg. "5 підходів по 80 кг" (no reps) = 5 * 80. */
export function tonnage(w: WorkoutLike): number {
  return (w.sets ?? 0) * (w.reps ?? 1) * (w.weightKg ?? 0);
}

/**
 * Consecutive Monday-start weeks with >=1 workout, counting back from now.
 * A still-unfinished current week doesn't break the streak.
 */
export function streakWeeks(dates: Date[], now = new Date()): number {
  const weeks = new Set(dates.map((d) => weekStart(d).getTime()));
  let cursor = weekStart(now).getTime();
  if (!weeks.has(cursor)) cursor -= WEEK_MS; // current week may simply not have happened yet
  let streak = 0;
  while (weeks.has(cursor)) {
    streak++;
    cursor -= WEEK_MS;
  }
  return streak;
}

/** Goal progress from the pair's workouts; `due` caps the counting window. */
export function goalProgress(
  goal: { metric: GoalMetric; due: Date | null },
  workouts: WorkoutLike[],
): number {
  const due = goal.due;
  const inWindow = due ? workouts.filter((w) => w.date <= due) : workouts;
  if (goal.metric === 'TOTAL_KG') {
    return Math.round(inWindow.reduce((sum, w) => sum + tonnage(w), 0));
  }
  return inWindow.length;
}

const WEEK_MS = 7 * 24 * 3600_000;

function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); // Monday = week start
  return x;
}
