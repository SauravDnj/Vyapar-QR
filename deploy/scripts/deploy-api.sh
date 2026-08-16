#!/usr/bin/env bash
# Deploys the QRHub API on a VPS — no Docker. Run this ON the VPS (locally,
# or via SSH from CI — see .github/workflows/deploy.yml).
#
# Assumes: Node 20+, pnpm, and PM2 already installed globally
# (`npm install -g pnpm pm2`), the repo already cloned at $APP_DIR with a
# real apps/api/.env in place (not committed), and MySQL/Redis reachable
# from DATABASE_URL/REDIS_URL in that .env.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/qrhub}"
cd "$APP_DIR"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing dependencies"
pnpm install --frozen-lockfile

echo "==> Generating Prisma client"
pnpm --filter api exec prisma generate

echo "==> Applying database migrations"
pnpm --filter api exec prisma migrate deploy

echo "==> Building the API"
pnpm --filter api build

echo "==> Reloading the PM2 process (zero-downtime if already running)"
cd apps/api
pm2 startOrReload ecosystem.config.js --env production
pm2 save

echo "==> Done"
