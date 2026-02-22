<?php
require_once __DIR__ . '/../config/config.php';

$queueFile = DATA_DIR . '/library/extraction_queue.json';
$queue = file_exists($queueFile) ? json_decode(file_get_contents($queueFile), true) : [];

$resetCount = 0;
foreach ($queue as $key => $item) {
    if ($item['status'] === 'processing') {
        $queue[$key]['status'] = 'pending';
        $resetCount++;
    }
}

file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "Reset $resetCount items from processing to pending.\n";
