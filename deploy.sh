#!/bin/bash
# deploy.sh — ikimon.life deployment with mandatory git sync
# Usage: bash deploy.sh [commit message]
#
# Flow: git add → git commit → git push → SSH deploy (git pull + PHP-FPM reload)
# This ensures every deploy is tracked in git history.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

VPS_KEY="$HOME/Downloads/ikimon.pem"
VPS_HOST="root@162.43.44.131"
VPS_DEPLOY_SCRIPT="/var/www/ikimon.life/deploy.sh"

# ── Pre-flight checks ──
if [ ! -f "$VPS_KEY" ]; then
    echo "ERROR: VPS key not found at $VPS_KEY"
    exit 1
fi

# ── Step 1: Git commit ──
echo "=== Step 1/3: Git Commit ==="

if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    echo "No changes to commit. Skipping git step."
else
    if [ $# -gt 0 ]; then
        COMMIT_MSG="$*"
    else
        CHANGED_COUNT=$(git status --short | wc -l | tr -d ' ')
        COMMIT_MSG="deploy: sync ${CHANGED_COUNT} files to production"
    fi

    git add -A
    git commit -m "$COMMIT_MSG"
    echo "Committed: $COMMIT_MSG"
fi

# ── Step 2: Git push ──
echo "=== Step 2/3: Git Push ==="
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
    echo "WARNING: Current branch is '$BRANCH', not 'main'. Switching to main first."
    git checkout main
    git merge "$BRANCH" --no-edit
fi

git push origin main
echo "Pushed to origin/main"

# ── Step 3: VPS deploy ──
echo "=== Step 3/3: VPS Deploy ==="
ssh -i "$VPS_KEY" "$VPS_HOST" "$VPS_DEPLOY_SCRIPT"
echo ""
echo "=== Deploy complete ==="
echo "Git:  $(git log --oneline -1)"
echo "Site: https://ikimon.life/"
