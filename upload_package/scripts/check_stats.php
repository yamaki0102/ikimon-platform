<?php
$h = json_decode(file_get_contents(__DIR__ . '/../data/library/worker_heartbeats.json'), true) ?: [];
$q = json_decode(file_get_contents(__DIR__ . '/../data/library/extraction_queue.json'), true) ?: [];

echo "Active Workers: " . count($h) . "\n";
print_r($h);

$counts = array_count_values(array_column($q, 'status'));
echo "Queue Status Counts:\n";
print_r($counts);
