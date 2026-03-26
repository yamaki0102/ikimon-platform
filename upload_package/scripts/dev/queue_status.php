<?php
require_once __DIR__ . '/../config/config.php';
$q = json_decode(file_get_contents(DATA_DIR . '/library/extraction_queue.json'), true);
$s = [];
foreach ($q as $name => $item) {
    $st = $item['status'] ?? 'unknown';
    if (!isset($s[$st])) $s[$st] = 0;
    $s[$st]++;
}
ksort($s);
foreach ($s as $status => $count) {
    echo str_pad($status, 20) . ": {$count}\n";
}
echo str_pad("TOTAL", 20) . ": " . count($q) . "\n";
