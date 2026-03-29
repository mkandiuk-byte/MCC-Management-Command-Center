#!/bin/bash
set -e
PANEL_DIR="/Users/kosenko/Desktop/AAP_pannel"
NEXT_BIN="$PANEL_DIR/node_modules/.pnpm/next@16.1.6_@babel+core@7.29.0_react-dom@19.2.3_react@19.2.3__react@19.2.3/node_modules/next/dist/bin/next"

cd "$PANEL_DIR"
node "$NEXT_BIN" build
exec node "$NEXT_BIN" start -p 3777
