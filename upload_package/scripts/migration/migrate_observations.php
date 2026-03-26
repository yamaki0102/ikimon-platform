<?php

/**
 * Migration script: Move observations from flat observations.json to partitioned files
 */
$base = dirname(__DIR__) . '/data';
$src = $base . '/observations.json';

if (!file_exists($src)) {
    echo "No observations.json found\n";
    exit;
}

$data = json_decode(file_get_contents($src), true);
echo "Total records in observations.json: " . count($data) . "\n";

// Group by month
$byMonth = [];
foreach ($data as $obs) {
    $date = $obs['observed_at'] ?? $obs['created_at'] ?? date('Y-m-d');
    $month = substr($date, 0, 7);
    if (!isset($byMonth[$month])) $byMonth[$month] = [];
    $byMonth[$month][] = $obs;
}

$dir = $base . '/observations';
if (!file_exists($dir)) mkdir($dir, 0777, true);

foreach ($byMonth as $month => $items) {
    $file = $dir . '/' . $month . '.json';
    $existing = file_exists($file) ? json_decode(file_get_contents($file), true) : [];
    $ids = array_column($existing, 'id');
    $added = 0;
    foreach ($items as $item) {
        if (!in_array($item['id'], $ids)) {
            $existing[] = $item;
            $ids[] = $item['id'];
            $added++;
        }
    }
    file_put_contents($file, json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo "  $month: $added new (total " . count($existing) . ")\n";
}

// Rename old file
$newName = $src . '.migrated_' . date('Ymd_His');
rename($src, $newName);
echo "Done! Renamed to " . basename($newName) . "\n";
