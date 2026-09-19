import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

/**
 * E2E runs against a dedicated database `gymbros_test` so dev data is never touched.
 * Requires postgres reachable on localhost:5433 — which holds in BOTH local dev
 * (docker compose `postgres` service, 5433:5432) and CI (GitHub Actions
 * `services.postgres`, host port 5433).
 *
 * Create the DB over TCP when a `psql` client is on PATH (CI runner), and fall
 * back to the psql binary inside the compose container (local dev boxes without
 * a host postgres client). Both drop-and-create the same dedicated database.
 */
const TEST_DB = 'postgresql://gymbros:gymbros@localhost:5433/gymbros_test';
const DROP_CREATE =
  `-c "DROP DATABASE IF EXISTS gymbros_test" -c "CREATE DATABASE gymbros_test"`;

function createTestDb(rootDir: string): void {
  const attempts = [
    // 1) TCP psql — GitHub Actions / any host with postgresql-client installed.
    {
      cmd: `psql -h 127.0.0.1 -p 5433 -U gymbros -d postgres ${DROP_CREATE}`,
      env: { ...process.env, PGPASSWORD: 'gymbros' },
    },
    // 2) psql inside the compose container — local dev, no host client needed.
    {
      cmd: `docker compose -p gym-partner-matching exec -T postgres psql -U gymbros -d postgres ${DROP_CREATE}`,
      env: process.env,
    },
  ];
  let lastError: unknown;
  for (const { cmd, env } of attempts) {
    try {
      execSync(cmd, { stdio: 'inherit', cwd: rootDir, env });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Could not create ${TEST_DB} (no TCP psql and no compose container): ${String(lastError)}`,
  );
}

export default async function globalSetup() {
  const url = TEST_DB;
  // __dirname is `apps/api/test` at runtime regardless of process.cwd() (which
  // is the monorepo root when jest is launched from there). Derive the api dir
  // from the file location so prisma migrate deploy always finds the schema.
  const rootDir = resolve(dirname(__filename), '..');

  createTestDb(rootDir);
  execSync(`${rootDir}/node_modules/.bin/prisma migrate deploy`, {
    stdio: 'inherit',
    cwd: rootDir,
    env: { ...process.env, DATABASE_URL: url, NODE_ENV: 'test' },
  });

  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'e2e-access-secret';
  process.env.PREVIEW_RATE_LIMIT = '1000'; // don't throttle e2e unless the test opts in
}
