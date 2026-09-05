#!/bin/bash
# Retired 2026-09-05: synthetic checks must not become production user posts.
# Keep the file as an explicit stop for older installed units; do not create data.
set -euo pipefail
printf '%s\n' 'production synthetic posting is disabled; use read-only production checks or isolated fixtures' >&2
exit 2
