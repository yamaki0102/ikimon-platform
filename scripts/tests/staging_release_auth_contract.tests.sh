#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="${REPO_ROOT}/scripts/run_cloudflare_staging_release.sh"

fail() { echo "FAIL: $*" >&2; exit 1; }

[[ -f "${SCRIPT}" ]] || fail "missing staging release script"
bash -n "${SCRIPT}"

grep -Fq 'whoami --json --env staging' "${SCRIPT}" || fail "fresh Wrangler auth proof missing"
if grep -Fq 'CLOUDFLARE_API_TOKEN is required' "${SCRIPT}"; then
  fail "token environment must not be the auth gate"
fi
grep -Fq 'do not treat token-env absence alone as the blocker' "${SCRIPT}" || fail "routing guidance missing"

toolchain_line="$(grep -nF '== Install Cloudflare staging Worker toolchain ==' "${SCRIPT}" | cut -d: -f1)"
auth_line="$(grep -nF '== Prove Cloudflare provider auth (OAuth session or API token) ==' "${SCRIPT}" | cut -d: -f1)"
build_line="$(grep -nF '== Install and build current app ==' "${SCRIPT}" | cut -d: -f1)"
[[ "${toolchain_line}" -lt "${auth_line}" && "${auth_line}" -lt "${build_line}" ]] || fail "auth proof must happen before app build"

echo "PASS: staging release auth contract"
