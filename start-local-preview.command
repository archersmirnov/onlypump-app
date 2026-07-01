#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-4174}"
URL="http://${HOST}:${PORT}/index.html"
CODEX_NODE="${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"

if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [ -x "$CODEX_NODE" ]; then
  NODE_BIN="$CODEX_NODE"
else
  echo "Node.js was not found."
  echo "Install Node.js or run this project from Codex, then try again."
  exit 1
fi

echo "Starting ONLYPUMP local preview..."
echo "$URL"
echo ""
echo "Leave this window open while testing."
echo "Press Ctrl+C to stop the preview server."
echo ""

open "$URL" >/dev/null 2>&1 || true
exec "$NODE_BIN" dev-server.mjs --host="$HOST" --port="$PORT"
