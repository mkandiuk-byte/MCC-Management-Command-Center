#!/bin/bash
# Kill anything on port 3777 before starting (prevents EADDRINUSE → .next/static wipe bug)
PORT_PID=$(lsof -ti:3777 2>/dev/null)
if [ -n "$PORT_PID" ]; then
  echo "[start-shell] Killing stale process on :3777 (PID $PORT_PID)"
  kill -9 $PORT_PID 2>/dev/null
  sleep 1
fi
cd "$(dirname "$0")"
exec node_modules/.bin/next start -p 3777
