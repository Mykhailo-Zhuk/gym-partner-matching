// DB-work micro-benchmark (real Postgres): the matching.search 3-query stage,
// sequential vs concurrent Promise.all. Isolates DB round-trip latency from
// framework/HTTP noise. USAGE: node bench-db.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const PODIL = '00000000-0000-4000-8000-000000000001';
const ITER = Number(process.env.DB_ITER ?? 400);

async function stageSequential(uids, userId) {
  const existing = await prisma.matchRequest.findMany({ where: { fromUserId: userId, status: { in: ['PENDING', 'DECLINED'] }, toUserId: { in: uids } }, select: { toUserId: true } });
  const matched = await prisma.match.findMany({ where: { status: 'ACTIVE', OR: [{ userAId: userId, userBId: { in: uids } }, { userBId: userId, userAId: { in: uids } }] }, select: { userAId: true, userBId: true } });
  const ratings = await prisma.rating.groupBy({ by: ['rateeId'], where: { rateeId: { in: uids } }, _avg: { punctuality: true, communication: true, spotting: true }, _count: { _all: true } });
  return { existing, matched, ratings };
}
async function stageParallel(uids, userId) {
  return Promise.all([
    prisma.matchRequest.findMany({ where: { fromUserId: userId, status: { in: ['PENDING', 'DECLINED'] }, toUserId: { in: uids } }, select: { toUserId: true } }),
    prisma.match.findMany({ where: { status: 'ACTIVE', OR: [{ userAId: userId, userBId: { in: uids } }, { userBId: userId, userAId: { in: uids } }] }, select: { userAId: true, userBId: true } }),
    prisma.rating.groupBy({ by: ['rateeId'], where: { rateeId: { in: uids } }, _avg: { punctuality: true, communication: true, spotting: true }, _count: { _all: true } }),
  ]);
}

function timed(fn) {
  const t0 = process.hrtime.bigint();
  const r = fn();
  const dt = Number(process.hrtime.bigint() - t0) / 1e6;
  return { dt, p: Promise.resolve(r) };
}
async function run(fn, n) {
  const times = [];
  for (let i = 0; i < n; i++) { const t0 = process.hrtime.bigint(); await fn(); times.push(Number(process.hrtime.bigint() - t0) / 1e6); }
  times.sort((a, b) => a - b);
  const p = (q) => times[Math.floor(q * (times.length - 1))];
  return { min: times[0], p50: p(0.5), p95: p(0.95), avg: times.reduce((s, x) => s + x, 0) / times.length };
}

(async () => {
  const me = await prisma.user.findUnique({ where: { email: 'bulk0@example.com' } });
  const users = await prisma.user.findMany({ where: { status: 'ACTIVE', role: 'USER', id: { not: me.id }, gymId: PODIL }, take: 50, select: { id: true } });
  const uids = users.map((u) => u.id);
  // warmup
  await run(() => stageSequential(uids, me.id), 10); await run(() => stageParallel(uids, me.id), 10);
  const seq = await run(() => stageSequential(uids, me.id), ITER);
  const par = await run(() => stageParallel(uids, me.id), ITER);
  const fmt = (o) => `min=${o.min.toFixed(2)} p50=${o.p50.toFixed(2)} p95=${o.p95.toFixed(2)} avg=${o.avg.toFixed(2)}`;
  console.log(`sequential\t${fmt(seq)}`);
  console.log(`parallel  \t${fmt(par)}`);
  console.log(`p50 delta: ${(seq.p50 - par.p50).toFixed(2)} ms faster parallel; avg delta: ${(seq.avg - par.avg).toFixed(2)} ms`);
  await prisma.$disconnect();
})();
