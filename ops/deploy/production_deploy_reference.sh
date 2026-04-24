#!/bin/bash
# production_deploy_reference.sh
# Reference implementation for the VPS-side deploy script.
# Actual execution target on server:
#   /var/www/ikimon.life/deploy.sh
#
# Keep this file aligned with the real server script.
# This script assumes:
# - application repo lives at /var/www/ikimon.life/repo
# - runtime data/config must survive git reset
# - uploads live in persistent storage and are symlinked into public_html
# - deploy is triggered only from GitHub Actions after merge to main

set -euo pipefail

APP_ROOT="/var/www/ikimon.life"
REPO_DIR="$APP_ROOT/repo"
DATA_DIR="$REPO_DIR/upload_package/data"
CONFIG_DIR="$REPO_DIR/upload_package/config"
UPLOADS_DIR="$REPO_DIR/upload_package/public_html/uploads"
PERSISTENT_ROOT="$APP_ROOT/persistent"
PERSISTENT_UPLOADS="$PERSISTENT_ROOT/uploads"
CURRENT_BRANCH="main"
BACKUP_DIR="$(mktemp -d /tmp/ikimon-deploy-XXXX)"
CONFIG_FILES=("config.php" "oauth_config.php" "secret.php")

cleanup() {
    rm -rf "$BACKUP_DIR"
}

trap cleanup EXIT

cd "$REPO_DIR"

echo "=== ikimon.life production deploy ==="
echo "Repo: $REPO_DIR"
echo "Branch: $CURRENT_BRANCH"

echo "[1/8] Fetch latest"
git fetch origin "$CURRENT_BRANCH" >/dev/null
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse "origin/$CURRENT_BRANCH")"
if [ "$LOCAL_HEAD" = "$REMOTE_HEAD" ]; then
    echo "Already up to date ($LOCAL_HEAD)"
    exit 0
fi

echo "[2/8] Back up runtime data"
mkdir -p "$BACKUP_DIR/data" "$BACKUP_DIR/config" "$PERSISTENT_UPLOADS"
if [ -d "$DATA_DIR" ]; then
    rsync -a "$DATA_DIR/" "$BACKUP_DIR/data/"
fi

echo "[3/8] Back up runtime config"
for file_name in "${CONFIG_FILES[@]}"; do
    if [ -f "$CONFIG_DIR/$file_name" ]; then
        cp -a "$CONFIG_DIR/$file_name" "$BACKUP_DIR/config/$file_name"
    fi
done

echo "[4/8] Sync uploads to persistent storage"
if [ -e "$UPLOADS_DIR" ]; then
    rsync -a "$UPLOADS_DIR/" "$PERSISTENT_UPLOADS/" >/dev/null 2>&1 || true
fi

echo "[5/8] Reset tracked code to origin/main"
git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || git checkout -f "$CURRENT_BRANCH"
git reset --hard "origin/$CURRENT_BRANCH"

echo "[6/8] Restore runtime data and config"
mkdir -p "$DATA_DIR" "$CONFIG_DIR"
rsync -a "$DATA_DIR/" "$BACKUP_DIR/data/" >/dev/null 2>&1 || true
rsync -a "$BACKUP_DIR/data/" "$DATA_DIR/" >/dev/null 2>&1 || true
for file_name in "${CONFIG_FILES[@]}"; do
    if [ -f "$BACKUP_DIR/config/$file_name" ]; then
        cp -a "$BACKUP_DIR/config/$file_name" "$CONFIG_DIR/$file_name"
    fi
done

rm -rf "$UPLOADS_DIR"
ln -sfn "$PERSISTENT_UPLOADS" "$UPLOADS_DIR"

echo "[7/8] Fix permissions"
chown -R www-data:www-data "$REPO_DIR/upload_package"
chown -R www-data:www-data "$PERSISTENT_ROOT"
chown -h www-data:www-data "$UPLOADS_DIR" 2>/dev/null || true

echo "[8/8] Reload PHP-FPM"
systemctl reload php8.2-fpm

echo "[Verify] Basic health checks"
for url in \
    "https://ikimon.life/index.php" \
    "https://ikimon.life/explore.php" \
    "https://ikimon.life/post.php" \
    "https://ikimon.life/api/get_events.php"
do
    status_code="$(curl -s -o /dev/null -w "%{http_code}" "$url")"
    if [ "$status_code" -lt 200 ] || [ "$status_code" -ge 400 ]; then
        echo "Health check failed: $url => $status_code"
        exit 1
    fi
    echo "OK: $url => $status_code"
done

echo "Deploy complete: $(git rev-parse --short HEAD)"
