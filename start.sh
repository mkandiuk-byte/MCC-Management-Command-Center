#!/bin/bash
# AAP Panel start script
cd "$(dirname "$0")"

# Use the correct pnpm path (Homebrew on Apple Silicon)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/opt/homebrew/sbin"

# Start in production mode if built, otherwise dev
if [ -d ".next" ]; then
  exec pnpm start --port "${APP_PORT:-3777}"
else
  exec pnpm dev --port "${APP_PORT:-3777}"
fi
