#!/usr/bin/env bash
# macOS/Linux 入口：有 Node 走 .mjs，无 Node 走 bash 回退
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/git-push.mjs" "$@"
else
  exec bash "$SCRIPT_DIR/git-push.fallback.sh" "$@"
fi
