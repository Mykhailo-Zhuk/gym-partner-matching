import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

/**
 * E2E runs against a dedicated database `gymbros_test` so dev data is never touched.
 * Requires `docker compose up -d` (postgres service on :5433).
 */
export default async function globalSetup() {
  const url = 'postgresql://gymbros:gymbros@localhost:5433/gymbros_test';
  // __dirname is `apps/api/test` at runtime regardless of process.cwd() (which
  // is the monorepo root when jest is launched from there). Derive the api dir
  // from the file location so prisma migrate deploy always finds the schema.
  const rootDir = resolve(dirname(__filename), '..');

  execSync(
    `docker compose -p gym-partner-matching exec -T postgres psql -U gymbros -d postgres ` +
      `-c "DROP DATABASE IF EXISTS gymbros_test" -c "CREATE DATABASE gymbros_test"`,
    { stdio: 'inherit', cwd: rootDir },
  );
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
