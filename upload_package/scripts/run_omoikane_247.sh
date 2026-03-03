#!/bin/bash
# run_omoikane_247.sh
# 24/7 Watchdog for Omoikane v2.0 (Gemini Flash-Lite)
# Manages: Prefetcher + Extraction Daemon + DB Writer

cd "$(dirname "$0")"

echo "🧬 Starting Omoikane v2.0 Watchdog (24/7 Mode)..."
echo "   Engine: Gemini 2.5 Flash-Lite (Free tier, $0)"

# Kill existing daemons
pkill -f daemon_extraction_engine.php 2>/dev/null || true
pkill -f daemon_prefetcher.php 2>/dev/null || true
pkill -f daemon_db_writer.php 2>/dev/null || true
pkill -f multi_source_prefetcher.php 2>/dev/null || true
pkill -f cron_extraction_engine.php 2>/dev/null || true
pkill -f watchdog_worker.sh 2>/dev/null || true
sleep 2

# Reset stuck items
php -r "
require_once '../config/config.php';
require_once '../libs/ExtractionQueue.php';
\$eq = ExtractionQueue::getInstance();
\$r = \$eq->resetAllStuck();
echo 'Reset stuck: processing=' . \$r['processing'] . ' failed=' . \$r['failed'] . PHP_EOL;
"

# Create the watchdog worker script
cat > watchdog_worker.sh << 'EOF'
#!/bin/bash
SCRIPT_TO_RUN=$1
LOG_FILE=$2
echo "Watchdog monitoring: $SCRIPT_TO_RUN"
while true; do
    echo "[$(date)] Watchdog: Starting $SCRIPT_TO_RUN..." >> "$LOG_FILE"
    php "$SCRIPT_TO_RUN" >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?
    echo "[$(date)] Watchdog: $SCRIPT_TO_RUN exited with code $EXIT_CODE. Restarting in 5 seconds..." >> "$LOG_FILE"
    sleep 5
done
EOF

chmod +x watchdog_worker.sh

# Start DB Writer Watchdog
nohup ./watchdog_worker.sh "daemon_db_writer.php" "daemon_dbw.log" > /dev/null 2>&1 &
echo $! > watchdog_dbw.pid

# Start Prefetcher Watchdog
nohup ./watchdog_worker.sh "daemon_prefetcher.php" "daemon_pre.log" > /dev/null 2>&1 &
echo $! > watchdog_pre.pid

# Start Extraction Watchdog
nohup ./watchdog_worker.sh "daemon_extraction_engine.php" "daemon_ext.log" > /dev/null 2>&1 &
echo $! > watchdog_ext.pid

sleep 3

echo ""
echo "=========================================================="
echo "✅ Omoikane v2.0 Watchdogs Active (24/7)"
echo ""
echo "  DB Writer   PID : $(cat watchdog_dbw.pid)"
echo "  Prefetcher  PID : $(cat watchdog_pre.pid)"
echo "  Extraction  PID : $(cat watchdog_ext.pid)"
echo ""
echo "Logs:"
echo "  tail -f daemon_dbw.log"
echo "  tail -f daemon_pre.log"
echo "  tail -f daemon_ext.log"
echo ""
echo "Stop all: pkill -f watchdog_worker"
echo "=========================================================="
