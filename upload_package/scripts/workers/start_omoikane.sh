#!/bin/bash
# OMOIKANE Pipeline - One-Shot Startup Script
# Usage: bash start_omoikane.sh
# All services run in tmux sessions for persistence.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🧠 OMOIKANE Pipeline Startup"
echo "=============================="

# Kill any existing sessions
for s in webserver prefetcher extractor dbwriter; do
  tmux kill-session -t $s 2>/dev/null
done

# 1. Web Server
tmux new-session -d -s webserver "cd ${SCRIPT_DIR}/../public_html && php -S 0.0.0.0:8899"
echo "✅ webserver  → localhost:8899"

# 2. Prefetcher (literature fetcher)
tmux new-session -d -s prefetcher "cd ${SCRIPT_DIR} && php multi_source_prefetcher.php 2>&1 | tee /tmp/prefetcher.log"
echo "✅ prefetcher → /tmp/prefetcher.log"

# 3. Extraction Engine (continuous loop, batch=30)
tmux new-session -d -s extractor "cd ${SCRIPT_DIR} && while true; do php cron_extraction_engine.php none 30 2>&1 | tee -a /tmp/extractor.log; sleep 2; done"
echo "✅ extractor  → /tmp/extractor.log"

# 4. DB Writer (single-process SQLite writer)
tmux new-session -d -s dbwriter "cd ${SCRIPT_DIR} && php daemon_db_writer.php 2>&1 | tee /tmp/dbwriter.log"
echo "✅ dbwriter   → /tmp/dbwriter.log"

echo ""
echo "All services started. Use 'tmux ls' to verify."
echo "Monitor: tmux attach -t extractor"
