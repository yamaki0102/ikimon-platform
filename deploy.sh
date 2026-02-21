#!/bin/bash
# deploy.sh - Project deployment wrapper using PHP rsync script
TARGET_SCRIPT="/mnt/g/その他のパソコン/マイ ノートパソコン/antigravity/.agent/skills/deploy_xserver_standard/scripts/deploy_wsl.php"
if [ ! -f "$TARGET_SCRIPT" ]; then
    echo "ERROR: Global Deploy script not found at $TARGET_SCRIPT"
    exit 1
fi
php "$TARGET_SCRIPT" "$@"
