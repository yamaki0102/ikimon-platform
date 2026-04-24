#!/bin/bash
# staging_deploy_reference.sh
# Reference implementation for the staging VPS-side deploy script.
# Actual execution target on server:
#   /var/www/ikimon.life-staging/deploy.sh

set -euo pipefail

APP_ROOT="/var/www/ikimon.life-staging"
REPO_DIR="$APP_ROOT/repo"
DATA_DIR="$REPO_DIR/upload_package/data"
CONFIG_DIR="$REPO_DIR/upload_package/config"
UPLOADS_DIR="$REPO_DIR/upload_package/public_html/uploads"
PERSISTENT_ROOT="$APP_ROOT/persistent"
PERSISTENT_UPLOADS="$PERSISTENT_ROOT/uploads"
CURRENT_BRANCH="${STAGING_BRANCH:-staging}"
HEALTH_BASE_URL="${STAGING_BASE_URL:-http://127.0.0.1:8081}"
BACKUP_DIR="$(mktemp -d /tmp/ikimon-staging-deploy-XXXX)"
CONFIG_FILES=("config.php" "oauth_config.php" "secret.php")
RUNTIME_ALLOWLIST="$REPO_DIR/ops/deploy/runtime_persistent_allowlist.txt"

load_runtime_allowlist() {
    if [ ! -f "$RUNTIME_ALLOWLIST" ]; then
        echo "Missing runtime allowlist: $RUNTIME_ALLOWLIST"
        exit 1
    fi
    grep -v '^[[:space:]]*#' "$RUNTIME_ALLOWLIST" | sed '/^[[:space:]]*$/d'
}

copy_runtime_allowlist() {
    local src_root="$1"
    local dst_root="$2"
    local pattern rel rel_dir match rel_match

    while IFS= read -r pattern; do
        if [[ "$pattern" != upload_package/data/* ]]; then
            continue
        fi

        rel="${pattern#upload_package/data/}"

        if [[ "$rel" == *"/**" ]]; then
            rel_dir="${rel%/**}"
            if [ -d "$src_root/$rel_dir" ]; then
                mkdir -p "$dst_root/$rel_dir"
                rsync -a "$src_root/$rel_dir/" "$dst_root/$rel_dir/"
            fi
            continue
        fi

        if [[ "$rel" == *"*"* || "$rel" == *"?"* || "$rel" == *"["* ]]; then
            while IFS= read -r match; do
                [ -z "$match" ] && continue
                rel_match="${match#$src_root/}"
                mkdir -p "$dst_root/$(dirname "$rel_match")"
                rsync -a "$match" "$dst_root/$rel_match"
            done < <(compgen -G "$src_root/$rel" || true)
            continue
        fi

        if [ -e "$src_root/$rel" ]; then
            mkdir -p "$dst_root/$(dirname "$rel")"
            rsync -a "$src_root/$rel" "$dst_root/$rel"
        fi
    done < <(load_runtime_allowlist)
}

cleanup() {
    rm -rf "$BACKUP_DIR"
}

trap cleanup EXIT

if [ ! -d "$REPO_DIR/.git" ]; then
    echo "Staging repo is not initialized: $REPO_DIR"
    exit 1
fi

cd "$REPO_DIR"

echo "=== ikimon.life staging deploy ==="
echo "Repo: $REPO_DIR"
echo "Branch: $CURRENT_BRANCH"

echo "[1/8] Fetch latest"
git fetch origin "$CURRENT_BRANCH" >/dev/null
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse "origin/$CURRENT_BRANCH")"
if [ "$LOCAL_HEAD" = "$REMOTE_HEAD" ]; then
    echo "Already up to date ($LOCAL_HEAD)"
else
    echo "[2/8] Back up staging runtime data"
    mkdir -p "$BACKUP_DIR/data" "$BACKUP_DIR/config" "$PERSISTENT_UPLOADS"
    copy_runtime_allowlist "$DATA_DIR" "$BACKUP_DIR/data"

    echo "[3/8] Back up staging runtime config"
    for file_name in "${CONFIG_FILES[@]}"; do
        if [ -f "$CONFIG_DIR/$file_name" ]; then
            cp -a "$CONFIG_DIR/$file_name" "$BACKUP_DIR/config/$file_name"
        fi
    done

    echo "[4/8] Sync staging uploads to persistent storage"
    if [ -e "$UPLOADS_DIR" ]; then
        rsync -a "$UPLOADS_DIR/" "$PERSISTENT_UPLOADS/" >/dev/null 2>&1 || true
    fi

    echo "[5/8] Reset tracked code to origin/$CURRENT_BRANCH"
    git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || git checkout -f "$CURRENT_BRANCH"
    git reset --hard "origin/$CURRENT_BRANCH"

    echo "[6/8] Restore staging runtime data and config"
    mkdir -p "$DATA_DIR" "$CONFIG_DIR"
    copy_runtime_allowlist "$BACKUP_DIR/data" "$DATA_DIR"
    for file_name in "${CONFIG_FILES[@]}"; do
        if [ -f "$BACKUP_DIR/config/$file_name" ]; then
            cp -a "$BACKUP_DIR/config/$file_name" "$CONFIG_DIR/$file_name"
        fi
    done
fi

rm -rf "$UPLOADS_DIR"
ln -sfn "$PERSISTENT_UPLOADS" "$UPLOADS_DIR"

echo "[7/8] Fix permissions"
chown -R www-data:www-data "$REPO_DIR/upload_package"
chown -R www-data:www-data "$PERSISTENT_ROOT"
chown -h www-data:www-data "$UPLOADS_DIR" 2>/dev/null || true

echo "[8/8] Verify staging health"
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

echo "Staging deploy complete: $(git rev-parse --short HEAD)"
