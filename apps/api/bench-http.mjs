#!/usr/bin/env node
// HTTP latency benchmark for hot GymBrosUK endpoints against a REAL DB.
// Usage: node bench-http.mjs <endpoint...>  e.g. `search` `preview` `badges`
const BASE = process.env.API_URL ?? 'http://localhost:3999';
const EMAIL = process.env.BENCH_EMAIL ?? 'bulk0@example.com';
const PASSWORD = process.env.BENCH_PASSWORD ?? 'password123';
const PODIL = '00000000-0000-4000-8000-000000000001';
const ITER = Number(process.env.BENCH_ITER ?? 300);

async function login(email, password) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  return j?.tokens?.accessToken || j?.accessToken || (j?.data && j.data.accessToken) || null;
}

function endpointBuilder(kind, token) {
  const H = (body) => ({ method: 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) } });
  switch (kind) {
    case 'search': return (i) => fetch(`${BASE}/matching/search?gymId=${PODIL}`, H());
    case 'searchGoal': return (i) => fetch(`${BASE}/matching/search?gymId=${PODIL}&goal=STRENGTH`, H());
    case 'preview': return (i) => fetch(`${BASE}/matching/preview?gymId=${PODIL}`, H());
    case 'badges': return (i) => fetch(`${BASE}/users/me/badges`, H());
    case 'profile': return (i) => fetch(`${BASE}/auth/me`, H());
    case 'requests': return (i) => fetch(`${BASE}/matching/requests`, H());
    default: throw new Error(`unknown kind: ${kind}`);
  }
}

async function bench(kind, token) {
  const fn = endpointBuilder(kind, token);
  // warmup
  for (let i = 0; i < 5; i++) { await fn(i).catch(() => {}); }
  const times = [];
  let status = 200;
  for (let i = 0; i < ITER; i++) {
    const t0 = process.hrtime.bigint();
    try {
      const r = await fn(i);
      status = r.status;
      await r.arrayBuffer();
    } catch (e) { status = 0; }
    const t1 = process.hrtime.bigint();
    times.push(Number(t1 - t0) / 1e6);
  }
  times.sort((a, b) => a - b);
  const p = (q) => times[Math.floor(q * (times.length - 1))];
  const avg = times.reduce((s, x) => s + x, 0) / times.length;
  console.log(`${kind}\tstatus=${status}\tmin=${times[0].toFixed(2)}\tp50=${p(0.5).toFixed(2)}\tp95=${p(0.95).toFixed(2)}\tavg=${avg.toFixed(2)}\t(count=${times.length})`);
}

(async () => {
  const token = await login(EMAIL, PASSWORD);
  if (!token) { console.error('login failed'); process.exit(1); }
  const kinds = process.argv.slice(2);
  if (kinds.length === 0) kinds.push('search', 'searchGoal', 'preview', 'requests');
  for (const k of kinds) await bench(k, token);
})();
