<?php
// clean_garbage_queue.php
require_once __DIR__ . '/../../config/config.php';

$queueFile = DATA_DIR . '/library/extraction_queue.json';
$fp = fopen($queueFile, 'c+');
if (!$fp || !flock($fp, LOCK_EX)) die("Cannot lock queue.\n");
clearstatcache(true, $queueFile);
$sz = filesize($queueFile);
$queue = json_decode($sz > 0 ? fread($fp, $sz) : '', true) ?: [];

$cleaned = 0;
foreach ($queue as $name => &$item) {
    if ($item['status'] !== 'pending' && $item['status'] !== 'processing') continue;

    $parts = explode(' ', $name);
    $isGarbage = false;

    // Check 1: Not binominal (less than 2 words)
    if (count($parts) < 2) $isGarbage = true;

    // Check 2: Second word is capitalized (not a valid species epithet)
    if (isset($parts[1]) && preg_match('/^[A-Z]/', $parts[1])) $isGarbage = true;

    // Check 3: Contains known nonsensical keywords
    $keywords = ['citizen', 'Japan', 'Key to', 'Family', 'Class', 'Order', 'Unknown', 'Continuation'];
    foreach ($keywords as $kw) {
        if (stripos($name, $kw) !== false) {
            $isGarbage = true;
            break;
        }
    }

    if ($isGarbage) {
        $item['status'] = 'invalid_name';
        $cleaned++;
        // If it was processing, remove it from heartbeats
    }
}

ftruncate($fp, 0);
fseek($fp, 0);
fwrite($fp, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

echo "Cleaned $cleaned garbage entries.\n";
