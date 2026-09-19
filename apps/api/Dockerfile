# syntax=docker/dockerfile:1
# GymBrosUK API — production image.
# Build from the REPO ROOT (context = monorepo root, the pnpm workspace):
#   docker build -f apps/api/Dockerfile .
#
# Strategy: build inside the workspace, then bundle the pnpm node_modules
# VERBATIM (tar keeps symlinks; Docker COPY would dereference and break the
# per-package dependency resolution). The /app layout mirrors the repo so the
# relative symlinks inside apps/api/node_modules keep resolving.
# No pnpm at runtime — the container only needs node + the prisma CLI
# (devDependency, kept on purpose) for `migrate deploy` on boot.

############################ Build ############################
FROM node:22-alpine AS build
# openssl — Prisma engines on musl; python/make/g++ — bcrypt native build fallback
RUN apk add --no-cache openssl python3 make g++
RUN npm install -g pnpm@11.24.0

WORKDIR /repo

# Cacheable dependency layer: manifests only (all workspace importers — pnpm
# validates the lockfile against them, so mobile/admin package.json must exist)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --frozen-lockfile --filter api

# Build the API
COPY apps/api/ apps/api/
WORKDIR /repo/apps/api
RUN pnpm exec prisma generate \
 && pnpm build

# Bundle: pnpm store + the api's node_modules (symlinked into the store),
# extracted later at /app preserving the repo-relative layout.
RUN mkdir -p /bundle/apps/api \
 && cp -r dist prisma package.json /bundle/apps/api/ \
 && tar -C /repo -cf /bundle.tar node_modules/.pnpm node_modules/.modules.yaml apps/api/node_modules

############################ Runtime ############################
FROM node:22-alpine
RUN apk add --no-cache openssl tzdata
ENV NODE_ENV=production
WORKDIR /app/apps/api

COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY --from=build /bundle.tar /tmp/bundle.tar
COPY --from=build /bundle/apps/api/dist dist/
COPY --from=build /bundle/apps/api/prisma prisma/
COPY --from=build /bundle/apps/api/package.json package.json
RUN tar -xf /tmp/bundle.tar -C /app \
 && rm /tmp/bundle.tar \
 && chmod +x /usr/local/bin/docker-entrypoint.sh \
 && addgroup -S app && adduser -S app -G app \
 && chown -R app:app /app
USER app

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]