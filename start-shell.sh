#!/bin/bash
PORT="${PORT:-3777}"

# Kill anything on the target port before starting (prevents EADDRINUSE on local dev)
# lsof may not be available in Docker/Linux — skip silently if absent
if command -v lsof > /dev/null 2>&1; then
  echo "[start-shell] Clearing port ${PORT}..."
  lsof -ti:"${PORT}" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  sleep 1
fi

cd "$(dirname "$0")"
exec node_modules/.bin/next start -p "${PORT}"
