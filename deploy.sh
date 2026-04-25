#!/bin/bash
# deploy.sh — local release preflight for ikimon.life
# Production deploy route:
#   branch -> PR -> merge to main -> GitHub Actions -> VPS deploy script

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

echo "=== ikimon.life release preflight ==="
echo "This script does not commit, merge, push, or SSH deploy."
echo "Production deploy is triggered only by merge to main."
echo

CURRENT_BRANCH="$(git branch --show-current)"
echo "Current branch: ${CURRENT_BRANCH}"

echo
echo "[1/3] Deploy guardrails"
if command -v pwsh >/dev/null 2>&1; then
    pwsh -File ./scripts/check_deploy_guardrails.ps1
elif command -v powershell >/dev/null 2>&1; then
    powershell -ExecutionPolicy Bypass -File .\\scripts\\check_deploy_guardrails.ps1
else
    echo "ERROR: PowerShell is required for scripts/check_deploy_guardrails.ps1"
    exit 1
fi

echo
echo "[2/3] PHP lint"
php tools/lint.php

echo
echo "[3/3] Next step"
echo "Push your branch, open a PR, and merge to main after review."
echo "GitHub Actions will handle production deploy."
