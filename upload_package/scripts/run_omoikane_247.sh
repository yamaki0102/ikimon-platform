#!/bin/bash
# run_omoikane_247.sh
# 24/7 Watchdog for Omoikane Extraction Engine Daemons

cd "$(dirname "$0")"

echo "Starting Omoikane Watchdog (24/7 Mode)..."

# Kill existing daemons if they are running standalone
pkill -f daemon_extraction_engine.php || true
pkill -f daemon_prefetcher.php || true
pkill -f watchdog_worker.sh || true

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

# Start Prefetcher Watchdog in background
nohup ./watchdog_worker.sh "daemon_prefetcher.php" "daemon_pre.log" > /dev/null 2>&1 &
echo $! > watchdog_pre.pid

# Start Extraction Watchdog in background
nohup ./watchdog_worker.sh "daemon_extraction_engine.php" "daemon_ext.log" > /dev/null 2>&1 &
echo $! > watchdog_ext.pid

echo ""
echo "=========================================================="
echo "Watchdogs started successfully. They will run 24/7 forever."
echo "Prefetcher Watchdog PID : $(cat watchdog_pre.pid)"
echo "Extraction Watchdog PID : $(cat watchdog_ext.pid)"
echo "Logs:"
echo "  - tail -f daemon_pre.log"
echo "  - tail -f daemon_ext.log"
echo "=========================================================="
