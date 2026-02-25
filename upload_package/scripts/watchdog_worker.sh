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
