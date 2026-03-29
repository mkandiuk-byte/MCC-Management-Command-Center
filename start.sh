#!/bin/bash
# AAP Panel start script
cd "$(dirname "$0")"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/opt/homebrew/sbin"

# ── Mode selection ────────────────────────────────────────────────────────────
MODE="${1:-auto}"   # auto | dev | pm2 | shell-only

if [ "$MODE" = "pm2" ]; then
  # Production: start all services + shell via PM2
  echo "[start] Starting all services via PM2..."
  pm2 start ecosystem.config.cjs
  pm2 status
  exit 0
fi

if [ "$MODE" = "shell-only" ]; then
  # Legacy: just run Next.js (no Fastify services)
  if [ -d ".next" ]; then
    exec pnpm start --port "${APP_PORT:-3777}"
  else
    exec pnpm dev --port "${APP_PORT:-3777}"
  fi
fi

# ── Auto / dev mode: start services in background + Next.js in foreground ────
echo "[start] Starting Fastify microservices in background..."

# Start each service (tsx from root node_modules)
SHARED_ENV="PANEL_CONFIG_PATH=$(pwd)/.panel-config.json PANEL_ROOT=$(pwd)"

start_service() {
  local name="$1" dir="$2" port="$3"
  local tsx="$(pwd)/services/${dir}/node_modules/.bin/tsx"
  if [ ! -f "$tsx" ]; then tsx="$(pwd)/node_modules/.bin/tsx"; fi
  if [ -f "$tsx" ]; then
    env PANEL_CONFIG_PATH="$(pwd)/.panel-config.json" PANEL_ROOT="$(pwd)" \
      "$tsx" "services/${dir}/src/index.ts" &
    echo "[start] ${name} service PID=$! (port ${port})"
    echo $!
  else
    echo "[start] WARNING: tsx not found for ${name}" >&2
    echo ""
  fi
}

KEITARO_PID=$(start_service "keitaro" "keitaro" 3801 | tail -1)
JIRA_PID=$(start_service "jira" "jira" 3802 | tail -1)
WORKSPACE_PID=$(start_service "workspace" "workspace" 3803 | tail -1)
CLAUDE_PID=$(start_service "claude" "claude" 3804 | tail -1)

# Give services a moment to bind
sleep 1

# Cleanup background services when shell exits
trap 'kill $KEITARO_PID $JIRA_PID $WORKSPACE_PID $CLAUDE_PID 2>/dev/null' EXIT INT TERM

echo "[start] Starting Next.js shell..."
if [ -d ".next" ]; then
  exec pnpm start --port "${APP_PORT:-3777}"
else
  exec pnpm dev --port "${APP_PORT:-3777}"
fi
