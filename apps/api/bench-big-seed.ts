/**
 * DB-perf harness: bloat the real Postgres with a large user graph so the
 * hot API queries (matching.search etc.) have real work and missing-index /
 * seq-scan issues become measurable. NOT the production seed — test/demo aid.
 */
import { Goal, Level, PrismaClient, RequestStatus, MatchStatus, type Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const PODIL = '00000000-0000-4000-8000-000000000001';
const LYBI = '00000000-0000-4000-8000-000000000002';
const N = Number(process.env.SEED_N ?? 50_000);
const KEEP_IDS = Number(process.env.SEED_KEEP ?? 400); // individual users used to build matches/requests/ratings
const CHUNK = 2000;

const levels: Level[] = [Level.BEGINNER, Level.INTERMEDIATE, Level.ADVANCED];
const goals: Goal[] = [Goal.MASS, Goal.CUT, Goal.STRENGTH, Goal.ENDURANCE, Goal.GENERAL];
const schedules: (string | undefined)[] = [
  'вечір після 18:00',
  'ранок 07:00–09:00',
  'обід 12:00–14:00',
  'вечір після 20:00',
  undefined,
];

async function main() {
  const pw = await bcrypt.hash('password123', 4); // test-only: cheaper cost for scale
  const searcherEmail = 'bulk0@gymbros.dev';

  // --- bulk users (createMany chunks; gymId deterministic for same-gym candidacy) ---
  let inserted = 0;
  for (let start = 0; start < N; start += CHUNK) {
    const end = Math.min(start + CHUNK, N);
    const rows: Prisma.UserCreateManyInput[] = [];
    for (let i = start; i < end; i++) {
      rows.push({
        email: `bulk${i}@example.com`,
        name: `User${i}`,
        passwordHash: i < KEEP_IDS ? pw : null, // keep first K password-able for login; rest social-style
        role: 'USER',
        status: 'ACTIVE',
        level: levels[i % 3],
        goal: goals[i % 5],
        schedule: schedules[i % 5],
        gymId: i % 3 === 2 ? LYBI : PODIL,
      });
    }
    const res = await prisma.user.createMany({
      data: rows,
      skipDuplicates: true,
    });
    inserted += res.count;
  }
  console.log(`users inserted: ${inserted}`);

  // ensure the fixed searcher exists & is on Podil with a password
  const searcher = await prisma.user.upsert({
    where: { email: searcherEmail },
    update: { gymId: PODIL },
    create: { email: searcherEmail, name: 'Bulk Searcher', passwordHash: pw, role: 'USER', status: 'ACTIVE', gymId: PODIL, level: Level.INTERMEDIATE, goal: Goal.STRENGTH },
  });

  // --- fetch ids of the first K bulk users to wire a graph ---
  const emails = Array.from({ length: KEEP_IDS }, (_, i) => `bulk${i}@example.com`);
  const kept = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });
  const byEmail = new Map(kept.map((u) => [u.email, u.id]));

  // --- ACTIVE matches from searcher to a slice (drives match-exclusion query) ---
  const matchData: Prisma.MatchCreateManyInput[] = [];
  for (let i = 1; i <= 60; i++) {
    const other = byEmail.get(`bulk${i}@example.com`);
    if (!other) continue;
    const [a, b] = searcher.id < other ? [searcher.id, other] : [other, searcher.id];
    matchData.push({ userAId: a, userBId: b, status: MatchStatus.ACTIVE });
  }
  await prisma.match.createMany({ data: matchData, skipDuplicates: true });
  console.log(`matches: ${matchData.length}`);

  // --- pending/declined requests from searcher (drives request-exclusion query) ---
  for (let i = 61; i <= 120; i++) {
    const other = byEmail.get(`bulk${i}@example.com`);
    if (!other) continue;
    await prisma.matchRequest.create({
      data: { fromUserId: searcher.id, toUserId: other, status: i % 2 ? RequestStatus.PENDING : RequestStatus.DECLINED },
    }).catch(() => null);
  }

  // --- ratings: one per ACTIVE match (ratee = the other user) so ratingSummaries has real rows ---
  for (let i = 1; i <= 60; i++) {
    const other = byEmail.get(`bulk${i}@example.com`);
    if (!other) continue;
    const match = await prisma.match.findFirst({ where: { OR: [{ userAId: searcher.id, userBId: other }, { userAId: other, userBId: searcher.id }] } });
    if (!match) continue;
    await prisma.rating.create({
      data: { matchId: match.id, raterId: searcher.id, rateeId: other, punctuality: 4, communication: 5, spotting: 4 },
    }).catch(() => null);
  }

  // --- some workouts on those matches (for workout-scoped queries) ---
  for (let i = 1; i <= 40; i++) {
    const other = byEmail.get(`bulk${i}@example.com`);
    if (!other) continue;
    const match = await prisma.match.findFirst({ where: { OR: [{ userAId: searcher.id, userBId: other }, { userAId: other, userBId: searcher.id }] } });
    if (!match) continue;
    await prisma.workout.createMany({
      data: [
        { matchId: match.id, userId: searcher.id, date: new Date(), type: 'Силове', sets: 4, reps: 10, weightKg: 80 },
        { matchId: match.id, userId: other, date: new Date(), type: 'Силове', sets: 3, reps: 12, weightKg: 60 },
      ],
      skipDuplicates: false,
    }).catch(() => null);
  }

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.match.count(),
    prisma.rating.count(),
    prisma.workout.count(),
  ]);
  console.log(`final counts users=${counts[0]} matches=${counts[1]} ratings=${counts[2]} workouts=${counts[3]}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
