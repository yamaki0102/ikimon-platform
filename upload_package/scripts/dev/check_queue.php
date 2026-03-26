<?php
require_once __DIR__ . '/../config/config.php';
$q = json_decode(file_get_contents(DATA_DIR . '/library/extraction_queue.json'), true) ?: [];
$targets = ['Anser canagicus', 'Anser fabalis', 'Anser caerulescens', 'Myiopsitta monachus', 'Cryptomeria japonica', 'Aythya collaris', 'Gavia adamsii'];
foreach ($targets as $sp) {
    if (isset($q[$sp])) {
        echo $sp . ': ' . count($q[$sp]['prefetched_literature'] ?? []) . " docs, status: " . $q[$sp]['status'] . "\n";
    } else {
        echo $sp . ": not in queue\n";
    }
}
