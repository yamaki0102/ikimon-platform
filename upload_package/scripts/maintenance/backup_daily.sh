#!/bin/bash
# Daily Backup Script for ikimon.life
# Run via cron: 0 3 * * * /path/to/backup_daily.sh
#
# Backs up data/ directory to ~/backups/ikimon/
# Keeps last 7 daily backups.

SITE_ROOT="/var/www/ikimon.life/repo/upload_package"
BACKUP_DIR="/var/www/ikimon.life/backups"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=7

# Ensure backup dir exists
mkdir -p "$BACKUP_DIR"

# Create tarball of data directory
echo "[$(date)] Starting backup..."
tar -czf "$BACKUP_DIR/data_$DATE.tar.gz" -C "$SITE_ROOT" data/

if [ $? -eq 0 ]; then
    echo "[$(date)] Backup created: data_$DATE.tar.gz"
    SIZE=$(du -sh "$BACKUP_DIR/data_$DATE.tar.gz" | cut -f1)
    echo "[$(date)] Size: $SIZE"
else
    echo "[$(date)] ERROR: Backup failed!"
    exit 1
fi

# Clean up old backups (keep last N days)
echo "[$(date)] Cleaning backups older than $KEEP_DAYS days..."
find "$BACKUP_DIR" -name "data_*.tar.gz" -mtime +$KEEP_DAYS -delete

REMAINING=$(ls -1 "$BACKUP_DIR"/data_*.tar.gz 2>/dev/null | wc -l)
echo "[$(date)] Remaining backups: $REMAINING"
echo "[$(date)] Done."
