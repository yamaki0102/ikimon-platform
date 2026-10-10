#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'EOF'
Production legacy mirror refresh is retired.
The public runtime now reads the VPS-local persistent mirror and must not
reconnect to the former hosting provider. Restore the archived mirror locally
from the migration backup if a rebuild is ever required.
EOF
exit 1
