#!/bin/sh
# GymBrosUK API container entrypoint:
# 1. apply pending Prisma migrations (safe to run on every boot — idempotent)
# 2. start the API (exec so signals reach Node, container stops gracefully)
set -e

echo "[entrypoint] applying database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "[entrypoint] starting API..."
exec node dist/main.js