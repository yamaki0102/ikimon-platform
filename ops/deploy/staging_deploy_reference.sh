#!/bin/bash
# staging_deploy_reference.sh
# Reference implementation for the staging VPS-side deploy script.
# Actual execution target on server:
#   /var/www/ikimon.life-staging/deploy.sh

set -euo pipefail

APP_ROOT="/var/www/ikimon.life-staging"
REPO_DIR="$APP_ROOT/repo"
WORKTREE_DATA_DIR="$REPO_DIR/upload_package/data"
WORKTREE_CONFIG_DIR="$REPO_DIR/upload_package/config"
WORKTREE_UPLOADS_DIR="$REPO_DIR/upload_package/public_html/uploads"
PERSISTENT_ROOT="$APP_ROOT/persistent"
PERSISTENT_DATA="$PERSISTENT_ROOT/data"
PERSISTENT_CONFIG="$PERSISTENT_ROOT/config"
PERSISTENT_UPLOADS="$PERSISTENT_ROOT/uploads"
BACKUP_ROOT="$APP_ROOT/backups"
CURRENT_BRANCH="${STAGING_BRANCH:-staging}"
HEALTH_BASE_URL="${STAGING_BASE_URL:-http://127.0.0.1:8081}"
STAMP="$(date +%Y%m%d_%H%M%S)"
RUNTIME_BACKUP_DIR="$BACKUP_ROOT/staging_runtime_externalized_$STAMP"

sync_dir_contents() {
    local src="$1"
    local dst="$2"

    if [ -d "$src" ]; then
        mkdir -p "$dst"
        rsync -a "$src/" "$dst/"
    fi
}

seed_missing_dir_contents() {
    local src="$1"
    local dst="$2"

    if [ -d "$src" ]; then
        mkdir -p "$dst"
        rsync -a --ignore-existing "$src/" "$dst/"
    fi
}

backup_dir_contents() {
    local src="$1"
    local dst="$2"

    if [ -d "$src" ]; then
        mkdir -p "$dst"
        rsync -a "$src/" "$dst/"
    fi
}

copy_secret_if_present() {
    local src="$1"
    local dst="$2"

    if [ -f "$src/secret.php" ]; then
        mkdir -p "$dst"
        cp -a "$src/secret.php" "$dst/secret.php"
        chmod 600 "$dst/secret.php" || true
    fi
}

sync_uploads_to_persistent() {
    if [ ! -e "$WORKTREE_UPLOADS_DIR" ]; then
        return
    fi

    mkdir -p "$PERSISTENT_UPLOADS"

    local src_real
    local dst_real
    src_real="$(readlink -f "$WORKTREE_UPLOADS_DIR" 2>/dev/null || true)"
    dst_real="$(readlink -f "$PERSISTENT_UPLOADS" 2>/dev/null || true)"
    if [ -n "$src_real" ] && [ -n "$dst_real" ] && [ "$src_real" = "$dst_real" ]; then
        return
    fi

    rsync -a "$WORKTREE_UPLOADS_DIR/" "$PERSISTENT_UPLOADS/" >/dev/null 2>&1 || true
}

verify_clean_worktree() {
    local status
    status="$(git status --porcelain)"
    if [ -n "$status" ]; then
        echo "Staging worktree is not clean after deploy:"
        git status --short
        exit 1
    fi
}

if [ ! -d "$REPO_DIR/.git" ]; then
    echo "Staging repo is not initialized: $REPO_DIR"
    exit 1
fi

cd "$REPO_DIR"

echo "=== ikimon.life staging deploy ==="
echo "Repo: $REPO_DIR"
echo "Branch: $CURRENT_BRANCH"

echo "[1/9] Fetch latest"
git fetch origin "$CURRENT_BRANCH" >/dev/null

echo "[2/9] Back up current staging runtime"
mkdir -p "$RUNTIME_BACKUP_DIR"
backup_dir_contents "$PERSISTENT_DATA" "$RUNTIME_BACKUP_DIR/persistent/data"
backup_dir_contents "$PERSISTENT_CONFIG" "$RUNTIME_BACKUP_DIR/persistent/config"
backup_dir_contents "$PERSISTENT_UPLOADS" "$RUNTIME_BACKUP_DIR/persistent/uploads"
backup_dir_contents "$WORKTREE_DATA_DIR" "$RUNTIME_BACKUP_DIR/worktree/data"
backup_dir_contents "$WORKTREE_UPLOADS_DIR" "$RUNTIME_BACKUP_DIR/worktree/uploads"
copy_secret_if_present "$WORKTREE_CONFIG_DIR" "$RUNTIME_BACKUP_DIR/worktree/config"

echo "[3/9] Migrate runtime outside the git worktree"
mkdir -p "$PERSISTENT_DATA" "$PERSISTENT_CONFIG" "$PERSISTENT_UPLOADS"
sync_dir_contents "$WORKTREE_DATA_DIR" "$PERSISTENT_DATA"
sync_uploads_to_persistent
copy_secret_if_present "$WORKTREE_CONFIG_DIR" "$PERSISTENT_CONFIG"

echo "[4/9] Reset tracked code to origin/$CURRENT_BRANCH"
if [ -L "$WORKTREE_UPLOADS_DIR" ]; then
    rm -f "$WORKTREE_UPLOADS_DIR"
fi
git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || git checkout -f "$CURRENT_BRANCH"
git reset --hard "origin/$CURRENT_BRANCH"

echo "[5/9] Remove leftover worktree runtime files"
git clean -fd -- . >/dev/null
git clean -fdX -- upload_package/data upload_package/config upload_package/public_html/uploads >/dev/null

echo "[6/9] Seed persistent data from repo defaults"
seed_missing_dir_contents "$WORKTREE_DATA_DIR" "$PERSISTENT_DATA"

echo "[7/9] Fix permissions"
chown -R www-data:www-data "$REPO_DIR/upload_package"
chown -R www-data:www-data "$PERSISTENT_ROOT"

echo "[8/9] Verify staging health"
for url in \
    "$HEALTH_BASE_URL/index.php" \
    "$HEALTH_BASE_URL/explore.php" \
    "$HEALTH_BASE_URL/post.php" \
    "$HEALTH_BASE_URL/api/get_events.php"
do
    status_code="$(curl -s -o /dev/null -w "%{http_code}" "$url")"
    if [ "$status_code" -lt 200 ] || [ "$status_code" -ge 400 ]; then
        echo "Health check failed: $url => $status_code"
        exit 1
    fi
    echo "OK: $url => $status_code"
done

echo "[9/9] Verify clean git worktree"
verify_clean_worktree

echo "Runtime backup: $RUNTIME_BACKUP_DIR"
echo "Staging deploy complete: $(git rev-parse --short HEAD)"
