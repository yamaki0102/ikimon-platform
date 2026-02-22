<?php

/**
 * Remove synthetic test species (source = 'sample_injection') from the extraction queue.
 */
require_once __DIR__ . '/../config/config.php';

$queueFile = DATA_DIR . '/library/extraction_queue.json';
$queue = json_decode(file_get_contents($queueFile), true);

$before = count($queue);
$queue = array_filter($queue, function ($item) {
    return ($item['source'] ?? '') !== 'sample_injection';
});
$after = count($queue);

file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "Removed " . ($before - $after) . " synthetic test species.\n";
echo "Queue size: {$before} -> {$after}\n";
