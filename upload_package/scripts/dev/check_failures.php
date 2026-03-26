<?php
$queueFile = __DIR__ . '/../data/library/extraction_queue.json';
$q = json_decode(file_get_contents($queueFile), true) ?: [];
$failed = [];
foreach ($q as $sp => $v) {
    if ($v['status'] === 'failed') {
        $failed[$sp] = $v;
    }
}
$sample = array_slice($failed, 0, 3);
print_r($sample);
echo "\nTotal Failed: " . count($failed) . "\n";
