#!/bin/bash
# Kill all Omoikane processes and restart with new config

echo "=== Killing all Omoikane processes ==="
for pid in $(ps aux | grep -E 'cron_extraction|daemon_extraction|daemon_prefetcher|watchdog_worker|multi_source_prefetcher|daemon_db_writer' | grep -v grep | awk '{print $2}'); do
    kill -9 $pid 2>/dev/null
done

sleep 2

remaining=$(ps aux | grep -E 'cron_extraction|daemon_extraction|daemon_prefetcher|watchdog_worker|multi_source_prefetcher|daemon_db_writer' | grep -v grep | wc -l)
echo "Remaining processes: $remaining"

if [ "$remaining" -gt 0 ]; then
    echo "Force killing remaining..."
    ps aux | grep -E 'cron_extraction|daemon_extraction|daemon_prefetcher|watchdog_worker|multi_source_prefetcher|daemon_db_writer' | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null
    sleep 2
fi

# Reset stuck items
echo "=== Resetting stuck queue items ==="
cd /home/yamaki/projects/ikimon-platform/upload_package
php scripts/reset_stuck_items.php

# Sync queue with DB (prevent re-processing of already-distilled species)
echo "=== Syncing queue with DB ==="
php scripts/sync_queue_db.php 2>/dev/null | tail -5

# Start new daemons
echo "=== Starting new daemons ==="
cd scripts

# DB Writer (single instance)
nohup php daemon_db_writer.php > daemon_writer.log 2>&1 &

nohup bash watchdog_worker.sh daemon_extraction_engine.php daemon_ext.log &>/dev/null &
nohup bash watchdog_worker.sh daemon_prefetcher.php daemon_pre.log &>/dev/null &

sleep 5

echo "=== New process count ==="
echo -n "Extraction workers: "
ps aux | grep 'cron_extraction_engine' | grep -v grep | grep -v 'sh -c' | wc -l
echo -n "Prefetchers: "
ps aux | grep 'multi_source_prefetcher' | grep -v grep | grep -v 'sh -c' | wc -l
echo -n "DB Writers: "
ps aux | grep 'daemon_db_writer' | grep -v grep | wc -l
echo -n "Daemons: "
ps aux | grep -E 'daemon_(extraction|prefetcher)' | grep -v grep | wc -l
echo -n "Watchdogs: "
ps aux | grep 'watchdog' | grep -v grep | wc -l

# Verify batch size
echo ""
echo "=== Batch size verification ==="
ps aux | grep 'cron_extraction_engine.php none' | grep -v grep | head -3

