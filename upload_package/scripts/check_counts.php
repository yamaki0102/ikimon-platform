<?php
require_once __DIR__ . '/../config/config.php';
$q = json_decode(file_get_contents(DATA_DIR . '/library/extraction_queue.json'), true) ?: [];
$counts = [];
foreach ($q as $name => $item) {
    $st = $item['status'] ?? 'unknown';
    $counts[$st] = ($counts[$st] ?? 0) + 1;
}
print_r($counts);
