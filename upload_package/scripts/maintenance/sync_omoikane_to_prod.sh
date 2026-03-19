#!/bin/bash
# Omoikane DB Sync: WSL → Production (Onamae)
# Run as cron: 0 */6 * * * /home/yamaki/projects/ikimon-platform/upload_package/scripts/sync_omoikane_to_prod.sh

DB_PATH="/home/yamaki/projects/ikimon-platform/upload_package/data/library/omoikane.sqlite3"
REMOTE="production:~/public_html/ikimon.life/data/library/omoikane.sqlite3"
LOG="/tmp/omoikane_sync.log"

echo "[$(date)] Starting sync..." >> "$LOG"
scp -P 8022 "$DB_PATH" "$REMOTE" >> "$LOG" 2>&1
if [ $? -eq 0 ]; then
    echo "[$(date)] ✅ Sync complete ($(du -h "$DB_PATH" | cut -f1))" >> "$LOG"
else
    echo "[$(date)] ❌ Sync failed" >> "$LOG"
fi
