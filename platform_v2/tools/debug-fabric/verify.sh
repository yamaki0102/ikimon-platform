#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
cd "$SCRIPT_DIR"
for file in run.mjs analyze-control-plane.mjs plan-execution.mjs lib/*.mjs tests/*.mjs local-runner/run-local.mjs local-runner/lib/*.mjs local-runner/tests/*.mjs; do node --check "$file"; done
node --test tests/*.test.mjs local-runner/tests/*.test.mjs
for file in profiles/*.json policy/*.json local-runner/profiles/*.json; do
  node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$file"
done
if grep -RInE '(gh[pousr]_[A-Za-z0-9_]{12,}|sk-[A-Za-z0-9_-]{12,}|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY)' .; then
  echo 'credential-shaped text found' >&2
  exit 1
fi
printf 'DEBUG_FABRIC_PHASE1_VERIFY_OK\n'
