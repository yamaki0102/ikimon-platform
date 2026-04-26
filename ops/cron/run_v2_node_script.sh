#!/bin/bash
# Wrapper to run platform_v2 dist/scripts/<name>.js against the active blue/green color.
# Called from crontab. Loads /etc/ikimon/production-v2.env and cd's into the active runtime.
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <script_basename> [args...]" >&2
  exit 2
fi

SCRIPT_NAME="$1"
shift

ACTIVE_COLOR="$(cat /var/www/ikimon.life/deploy_state/active_color 2>/dev/null || echo blue)"
case "$ACTIVE_COLOR" in
  blue|green) ;;
  *) echo "invalid active color: $ACTIVE_COLOR" >&2; exit 3 ;;
esac

RUNTIME_DIR="/var/www/ikimon.life/runtime/${ACTIVE_COLOR}"
SCRIPT_PATH="${RUNTIME_DIR}/dist/scripts/${SCRIPT_NAME}.js"
if [ ! -f "$SCRIPT_PATH" ]; then
  echo "script not found: $SCRIPT_PATH" >&2
  exit 4
fi

set -a
. /etc/ikimon/production-v2.env
set +a

cd "$RUNTIME_DIR"
exec /usr/bin/env node "dist/scripts/${SCRIPT_NAME}.js" "$@"
