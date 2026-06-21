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
STAGING_DEPLOY_BACKUP_ROOT="${STAGING_DEPLOY_BACKUP_ROOT:-$PERSISTENT_ROOT/deploy-tmp}"
CURRENT_BRANCH="${STAGING_BRANCH:-staging}"
ALLOW_NON_FF="${STAGING_ALLOW_NON_FF:-false}"
VERIFY_LEVEL="${STAGING_VERIFY_LEVEL:-auto}"
HEALTH_BASE_URL="${STAGING_BASE_URL:-http://127.0.0.1:8081}"
BACKUP_DIR=""
CONFIG_FILES=("config.php" "oauth_config.php" "secret.php")
RUNTIME_ALLOWLIST="$REPO_DIR/ops/deploy/runtime_persistent_allowlist.txt"
RUNTIME_RSYNC_EXCLUDES=(
    "--exclude=*.sqlite"
    "--exclude=*.sqlite3"
    "--exclude=*.sqlite3-shm"
    "--exclude=*.sqlite3-wal"
    "--exclude=*.db"
)

load_runtime_allowlist() {
    if [ ! -f "$RUNTIME_ALLOWLIST" ]; then
        echo "Missing runtime allowlist: $RUNTIME_ALLOWLIST"
        exit 1
    fi
    grep -v '^[[:space:]]*#' "$RUNTIME_ALLOWLIST" | sed '/^[[:space:]]*$/d'
}

rsync_runtime_copy() {
    local source="$1"
    local dest="$2"
    shift 2
    local rc=0

    rsync -a "${RUNTIME_RSYNC_EXCLUDES[@]}" "$@" "$source" "$dest" || rc=$?
    if [ "$rc" -eq 24 ]; then
        echo "Warning: runtime file vanished during backup/restore: $source"
        return 0
    fi
    return "$rc"
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
        if [[ "$rel" == "library" || "$rel" == "library/"* ]]; then
            # Untracked/generated library artifacts are preserved by git reset
            # and should not be duplicated through deploy backup.
            continue
        fi

        if [[ "$rel" == *"/**" ]]; then
            rel_dir="${rel%/**}"
            if [ -d "$src_root/$rel_dir" ]; then
                mkdir -p "$dst_root/$rel_dir"
                rsync_runtime_copy "$src_root/$rel_dir/" "$dst_root/$rel_dir/"
            fi
            continue
        fi

        if [[ "$rel" == *"*"* || "$rel" == *"?"* || "$rel" == *"["* ]]; then
            while IFS= read -r match; do
                [ -z "$match" ] && continue
                rel_match="${match#$src_root/}"
                mkdir -p "$dst_root/$(dirname "$rel_match")"
                rsync_runtime_copy "$match" "$dst_root/$rel_match"
            done < <(compgen -G "$src_root/$rel" || true)
            continue
        fi

        if [ -e "$src_root/$rel" ]; then
            mkdir -p "$dst_root/$(dirname "$rel")"
            rsync_runtime_copy "$src_root/$rel" "$dst_root/$rel"
        fi
    done < <(load_runtime_allowlist)
}

prepare_backup_dir() {
    mkdir -p "$STAGING_DEPLOY_BACKUP_ROOT"
    STAGING_DEPLOY_BACKUP_ROOT="$(cd "$STAGING_DEPLOY_BACKUP_ROOT" && pwd -P)"
    BACKUP_DIR="$(mktemp -d "$STAGING_DEPLOY_BACKUP_ROOT/ikimon-staging-deploy-XXXXXX")"
}

print_runtime_backup_diagnostics() {
    local df_targets=("$STAGING_DEPLOY_BACKUP_ROOT" "$PERSISTENT_ROOT" "/tmp")
    if [ -e "$DATA_DIR" ]; then
        df_targets+=("$DATA_DIR")
    fi

    echo "Runtime backup temp root: $STAGING_DEPLOY_BACKUP_ROOT"
    echo "Runtime backup temp dir: $BACKUP_DIR"
    echo "Runtime backup filesystem capacity:"
    df -h "${df_targets[@]}" 2>/dev/null || true
    echo "Runtime data size sample:"
    du -sh "$DATA_DIR" "$DATA_DIR/library" 2>/dev/null || true
}

cleanup() {
    if [ -n "${BACKUP_DIR:-}" ] && [ -d "$BACKUP_DIR" ]; then
        case "$BACKUP_DIR" in
            "$STAGING_DEPLOY_BACKUP_ROOT"/ikimon-staging-deploy-*)
                rm -rf -- "$BACKUP_DIR"
                ;;
            *)
                echo "Refusing to clean unexpected staging backup dir: $BACKUP_DIR"
                ;;
        esac
    fi
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
if [ "$VERIFY_LEVEL" = "fast" ] && [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ] && ! git merge-base --is-ancestor "$LOCAL_HEAD" "$REMOTE_HEAD"; then
    echo "staging-fast permits non-fast-forward branch switches; this run is not production promotion evidence."
elif [ "$ALLOW_NON_FF" != "true" ] && [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ] && ! git merge-base --is-ancestor "$LOCAL_HEAD" "$REMOTE_HEAD"; then
    echo "Refusing non-fast-forward staging deploy."
    echo "Current staging HEAD: $LOCAL_HEAD"
    echo "Target branch HEAD:   $REMOTE_HEAD"
    echo "Target branch origin/$CURRENT_BRANCH does not contain the currently deployed commit."
    echo "This would roll staging back or replace another in-progress staging branch."
    echo "If this is an intentional rollback or branch switch, rerun with allow_non_fast_forward=true."
    exit 1
fi
if [ "$LOCAL_HEAD" = "$REMOTE_HEAD" ]; then
    echo "Already up to date ($LOCAL_HEAD)"
else
    echo "[2/8] Back up staging runtime data"
    prepare_backup_dir
    print_runtime_backup_diagnostics
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
echo "Release rehearsal gate: run GitHub Actions Deploy to Staging with verify_level=full to execute public_map_snapshot_alert_lifecycle."
