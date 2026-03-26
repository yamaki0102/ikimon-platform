<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Cache.php';
require_once __DIR__ . '/../libs/Indexer.php';

// Fix guest observations → assign to user_ya_001
$targetUser = DataStore::findById('users', 'user_ya_001');
if (!$targetUser) {
    echo "ERROR: user_ya_001 not found!\n";
    exit(1);
}

$dir = DATA_DIR . '/observations';
$files = glob($dir . '/*.json');
$totalFixed = 0;

foreach ($files as $file) {
    $data = json_decode(file_get_contents($file), true);
    if (!$data) continue;

    $modified = false;
    foreach ($data as &$obs) {
        if (isset($obs['user_id']) && str_starts_with($obs['user_id'], 'guest_')) {
            $obs['user_id'] = $targetUser['id'];
            $obs['user_name'] = $targetUser['name'];
            $obs['user_avatar'] = $targetUser['avatar'];
            $modified = true;
            $totalFixed++;
        }
    }
    unset($obs);

    if ($modified) {
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo "Fixed guests in " . basename($file) . "\n";
    }
}

// Also remove the test debug observation
$testFile = $dir . '/2026-02.json';
if (file_exists($testFile)) {
    $data = json_decode(file_get_contents($testFile), true);
    $data = array_values(array_filter($data, fn($o) => $o['id'] !== 'test_debug_001'));
    file_put_contents($testFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo "Removed test_debug_001\n";
}

echo "\nTotal guest observations fixed: $totalFixed\n";
echo "Done!\n";
