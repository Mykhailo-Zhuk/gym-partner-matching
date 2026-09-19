import { goalProgress, streakWeeks, tonnage } from './stats';

const w = (date: string, sets: number | null = null, reps: number | null = null, weightKg: number | null = null) => ({
  date: new Date(date),
  sets,
  reps,
  weightKg,
});

describe('dashboard stats (story #2)', () => {
  it('tonnage: sets * reps * weight; missing reps counts as 1 ("5 підходів по 80 кг" = 400)', () => {
    expect(tonnage(w('2026-06-01', 5, null, 80))).toBe(400);
    expect(tonnage(w('2026-06-01', 5, 10, 80))).toBe(4000);
    expect(tonnage(w('2026-06-01'))).toBe(0); // attendance-only entry
  });

  it('streakWeeks: consecutive Mon-start weeks; unfinished current week does not break it', () => {
    const d = (iso: string) => new Date(iso);
    const now = new Date('2026-06-10T12:00:00Z'); // Wednesday of week 24
    expect(streakWeeks([], now)).toBe(0);
    // trained this week + 2 previous = 3
    expect(streakWeeks([d('2026-06-08'), d('2026-06-03'), d('2026-05-26')], now)).toBe(3);
    // nothing this week yet, but last two weeks trained = 2
    expect(streakWeeks([d('2026-06-03'), d('2026-05-26')], now)).toBe(2);
    // gap two weeks ago breaks the streak
    expect(streakWeeks([d('2026-06-03'), d('2026-05-19')], now)).toBe(1);
  });

  it('goalProgress: counts workouts or sums kg; due caps the window', () => {
    const workouts = [w('2026-06-01', 5, null, 80), w('2026-06-20', 3, 10, 60), w('2026-07-05', 1, 1, 100)];
    expect(goalProgress({ metric: 'WORKOUT_COUNT', due: null }, workouts)).toBe(3);
    expect(goalProgress({ metric: 'WORKOUT_COUNT', due: new Date('2026-06-30') }, workouts)).toBe(2);
    expect(goalProgress({ metric: 'TOTAL_KG', due: null }, workouts)).toBe(400 + 1800 + 100);
    expect(goalProgress({ metric: 'TOTAL_KG', due: new Date('2026-06-30') }, workouts)).toBe(2200);
  });
});
