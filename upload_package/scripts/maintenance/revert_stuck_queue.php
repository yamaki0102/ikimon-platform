<?php
require_once __DIR__ . '/../../config/config.php';
$queueFile = DATA_DIR . '/library/extraction_queue.json';
$fpQ = fopen($queueFile, 'c+');
if ($fpQ && flock($fpQ, LOCK_EX)) {
    $size = filesize($queueFile);
    $queueJson = $size > 0 ? fread($fpQ, $size) : '';
    $queue = json_decode($queueJson, true) ?: [];
    $reverted = 0;
    foreach ($queue as $name => &$item) {
        if ($item['status'] === 'processing') {
            $item['status'] = 'pending';
            $reverted++;
        }
    }
    ftruncate($fpQ, 0);
    fseek($fpQ, 0);
    fwrite($fpQ, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fpQ);
    flock($fpQ, LOCK_UN);
    fclose($fpQ);
    echo "Reverted $reverted stuck items from 'processing' back to 'pending'.\n";
} else {
    echo "Failed to lock queue.\n";
}
