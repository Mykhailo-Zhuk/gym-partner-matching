# syntax=docker/dockerfile:1
# GymBrosUK admin panel — static build served by nginx, same-origin API proxy.
# Build from the REPO ROOT (context = monorepo root):
#   docker build -f apps/admin/Dockerfile .

############################ Build ############################
FROM node:22-alpine AS build
RUN npm install -g pnpm@11.24.0

WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --frozen-lockfile --filter admin

COPY apps/admin/ apps/admin/
RUN pnpm --filter admin build

############################ Runtime ############################
FROM nginx:1.27-alpine
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html
EXPOSE 80