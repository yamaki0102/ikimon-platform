<?php
$queueFile = __DIR__ . '/../data/library/extraction_queue.json';
$q = json_decode(file_get_contents($queueFile), true) ?: [];
$max = '2000-01-01';
$recentCount = 0;
foreach ($q as $sp => $v) {
    if ($v['status'] === 'failed' && isset($v['last_processed_at'])) {
        if ($v['last_processed_at'] > $max) {
            $max = $v['last_processed_at'];
        }
        if ($v['last_processed_at'] > '2026-02-22 08:00:00') {
            $recentCount++;
        }
    }
}
echo "Most recent failure: $max\n";
echo "Failures since 08:00 today: $recentCount\n";
