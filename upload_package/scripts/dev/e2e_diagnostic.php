<?php
// E2E diagnostic: Check photo paths, observation data, and Auth state
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Cache.php';
require_once __DIR__ . '/../libs/Indexer.php';

echo "=== PHOTO PATH CHECK ===\n";
$obs = DataStore::fetchAll('observations');
$total = count($obs);
$photosOk = 0;
$photosMissing = 0;
$photoBroken = [];

foreach ($obs as $o) {
    foreach (($o['photos'] ?? []) as $p) {
        $fullPath = PUBLIC_DIR . '/' . $p;
        if (file_exists($fullPath)) {
            $size = filesize($fullPath);
            if ($size > 100) {
                $photosOk++;
            } else {
                $photoBroken[] = ['id' => $o['id'], 'path' => $p, 'size' => $size];
            }
        } else {
            $photosMissing++;
        }
    }
}

echo "Total observations: $total\n";
echo "Photos OK (>100 bytes): $photosOk\n";
echo "Photos MISSING: $photosMissing\n";
echo "Photos BROKEN (<100 bytes): " . count($photoBroken) . "\n";
foreach (array_slice($photoBroken, 0, 5) as $b) {
    echo "  Broken: {$b['id']} -> {$b['path']} ({$b['size']} bytes)\n";
}

echo "\n=== USER-OBSERVATION MATCH ===\n";
$users = DataStore::get('users');
foreach ($users as $u) {
    $uid = $u['id'];
    $name = $u['name'] ?? '?';
    $count = 0;
    foreach ($obs as $o) {
        if (($o['user_id'] ?? '') === $uid) $count++;
    }
    if ($count > 0 || $uid === 'user_698853b4bb6d4') {
        echo "$uid ($name): $count observations\n";
    }
}

echo "\n=== SAMPLE OBSERVATION DATA ===\n";
// Show first observation's structure
if ($total > 0) {
    $sample = $obs[0];
    echo json_encode([
        'id' => $sample['id'],
        'user_id' => $sample['user_id'],
        'user_name' => $sample['user_name'],
        'photos' => $sample['photos'],
        'observed_at' => $sample['observed_at'] ?? '?',
        'status' => $sample['status'] ?? '?'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
}

echo "\nDone!\n";
