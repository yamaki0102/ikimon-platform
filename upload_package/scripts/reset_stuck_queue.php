<?php

/**
 * reset_stuck_queue.php
 * Resets items stuck in 'processing' state for more than 5 minutes.
 * Uses `claimed_at` (set when worker claims the item) for accurate staleness.
 */
require_once __DIR__ . '/../config/config.php';

$queueFile = DATA_DIR . '/library/extraction_queue.json';
$fp = fopen($queueFile, 'c+');
if (!$fp || !flock($fp, LOCK_EX)) die("Cannot lock queue.\n");
clearstatcache(true, $queueFile);
$sz = filesize($queueFile);
$queue = json_decode($sz > 0 ? fread($fp, $sz) : '', true) ?: [];

$resetCount = 0;
$staleThreshold = 300; // 5 minutes
$now = time();

foreach ($queue as $key => $item) {
    if (!in_array($item['status'], ['processing', 'fetching_lit'])) continue;

    // Use claimed_at (when worker grabbed it) for staleness check
    // Fallback to last_processed_at, then assume stale if neither exists
    $claimedAt = $item['claimed_at'] ?? $item['last_processed_at'] ?? null;
    if ($claimedAt === null) {
        // No timestamp at all — this is a ghost from before the fix, reset it
        $queue[$key]['status'] = 'pending';
        $resetCount++;
        continue;
    }

    $age = $now - strtotime($claimedAt);
    if ($age > $staleThreshold) {
        if ($item['status'] === 'processing') {
            $queue[$key]['status'] = 'literature_ready';
        } elseif ($item['status'] === 'fetching_lit') {
            $queue[$key]['status'] = 'pending';
        } else {
            $queue[$key]['status'] = 'pending';
        }
        $resetCount++;
    }
}

ftruncate($fp, 0);
fseek($fp, 0);
fwrite($fp, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

// === Cleanup Stale Worker Heartbeats ===
$heartbeatFile = DATA_DIR . '/library/worker_heartbeats.json';
$fpHb = @fopen($heartbeatFile, 'c+');
if ($fpHb && flock($fpHb, LOCK_EX)) {
    clearstatcache(true, $heartbeatFile);
    $szHb = filesize($heartbeatFile);
    $beats = json_decode($szHb > 0 ? fread($fpHb, $szHb) : '', true) ?: [];
    $activeBeats = [];
    $staleBeatsCount = 0;

    foreach ($beats as $pid => $data) {
        $updatedAt = $data['updated_at'] ?? 0;
        $ts = is_string($updatedAt) ? strtotime($updatedAt) : (int)$updatedAt;

        if ($now - $ts <= 300) { // Keep if updated within 5 minutes
            $activeBeats[$pid] = $data;
        } else {
            $staleBeatsCount++;
        }
    }

    if ($staleBeatsCount > 0) {
        ftruncate($fpHb, 0);
        fseek($fpHb, 0);
        fwrite($fpHb, json_encode($activeBeats, JSON_UNESCAPED_UNICODE));
        fflush($fpHb);
    }
    flock($fpHb, LOCK_UN);
    fclose($fpHb);
}

echo "Reset $resetCount stale items (>5min in queue) and removed $staleBeatsCount stale heartbeats.\n";
