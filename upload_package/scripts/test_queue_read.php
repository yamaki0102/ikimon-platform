<?php
require_once __DIR__ . '/../config/config.php';
$queueFile = DATA_DIR . '/library/extraction_queue.json';
$fpQ = fopen($queueFile, 'c+');
if (!$fpQ || !flock($fpQ, LOCK_EX)) die("Cannot lock queue file.\n");
clearstatcache(true, $queueFile);
$size = filesize($queueFile);
echo "File size: $size\n";
$queueJson = $size > 0 ? fread($fpQ, $size) : '';
$queue = json_decode($queueJson, true) ?: [];
echo "Queue elements parsed: " . count($queue) . "\n";
$readyCount = 0;
foreach ($queue as $name => $item) {
    if (isset($item['status']) && $item['status'] === 'literature_ready') {
        $readyCount++;
    }
}
echo "Ready items: $readyCount\n";
flock($fpQ, LOCK_UN);
fclose($fpQ);
