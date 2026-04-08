<?php

/**
 * Reset no_literature items back to pending for re-processing
 * with the improved multi-source prefetcher v2.
 */
require_once __DIR__ . '/../../config/config.php';

$queueFile = DATA_DIR . '/library/extraction_queue.json';

if (!file_exists($queueFile)) {
    echo "Queue file not found.\n";
    exit(1);
}

$queue = json_decode(file_get_contents($queueFile), true);
if (!is_array($queue)) {
    echo "Invalid queue JSON.\n";
    exit(1);
}

$resetCount = 0;
foreach ($queue as $id => &$item) {
    if ($item['status'] === 'no_literature') {
        $item['status'] = 'pending';
        // Clear old failed data
        unset($item['prefetched_literature']);
        unset($item['source_citations']);
        $resetCount++;
        echo "  Reset: {$id}\n";
    }
}
unset($item);

if ($resetCount > 0) {
    file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo "\nReset {$resetCount} items from no_literature -> pending.\n";
} else {
    echo "No items with no_literature status found.\n";
}
