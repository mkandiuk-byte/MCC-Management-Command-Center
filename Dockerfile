# ─────────────────────────────────────────────────────────────────────────────
# AAP Panel — single-image build
# All 7 services (Next.js + 6 Fastify) are managed by pm2-runtime inside
# one container.  Redis runs as a separate sidecar (see docker-compose.yml).
#
# Build:  docker build -t aap-panel .
# Run:    docker compose up -d
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine

# ── System deps ───────────────────────────────────────────────────────────────
# python3 / make / g++  → native modules (node-pty, better-sqlite3)
# git                   → workspace service (repo operations)
# bash                  → start-shell.sh interpreter
RUN apk add --no-cache python3 make g++ git bash

# ── pnpm + PM2 ───────────────────────────────────────────────────────────────
RUN corepack enable && corepack prepare pnpm@9 --activate
RUN npm install -g pm2

# ── App source ────────────────────────────────────────────────────────────────
WORKDIR /app
COPY . .

# Install all workspace dependencies (compiles native modules)
RUN pnpm install --frozen-lockfile

# Build Next.js production bundle
RUN pnpm build

# Logs directory (used by PM2 if not writing to stdout)
RUN mkdir -p logs

# ── Runtime ───────────────────────────────────────────────────────────────────
EXPOSE 3777

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3777/ > /dev/null || exit 1

# pm2-runtime = Docker-friendly pm2: no daemon, logs to stdout, respects signals
CMD ["pm2-runtime", "ecosystem.config.cjs"]
