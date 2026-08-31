#!/usr/bin/env bash
set -e
# Runs starchess-arena CLI via tsx, auto-fixing esbuild platform mismatch
# (e.g. node_modules copied from Linux → macOS). All args forwarded to CLI.
# Usage: ./scripts/arena.sh --pairing naive:strategic --seeds 4 --out ./arena-results

# Try first run; capture output to detect TransformError without losing stdout
set +e
OUTPUT=$(pnpm --filter @chess-coach/starchess-arena exec tsx src/cli/main.ts "$@" 2>&1)
STATUS=$?
set -e
if [ $STATUS -eq 0 ]; then
  echo "$OUTPUT"
  exit 0
fi
# Check for esbuild platform mismatch
if echo "$OUTPUT" | grep -q "esbuild.*for another platform"; then
  echo "arena: esbuild binary mismatch — rebuilding for this platform…" >&2
  echo "arena: running pnpm rebuild to fetch correct esbuild binary…" >&2
  pnpm --filter @chess-coach/starchess-arena exec npm rebuild esbuild 2>/dev/null || true
  pnpm install 2>&1 | tail -5 >&2 || true
  echo "arena: retrying…" >&2
  pnpm --filter @chess-coach/starchess-arena exec tsx src/cli/main.ts "$@"
  exit $?
else
  echo "$OUTPUT" >&2
  exit $STATUS
fi
