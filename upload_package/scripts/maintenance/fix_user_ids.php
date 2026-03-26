<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Cache.php';
require_once __DIR__ . '/../libs/Indexer.php';

$correctId = 'user_698853b4bb6d4';
$wrongId = 'user_ya_001';

// Get real user data
$targetUser = DataStore::findById('users', $correctId);
if (!$targetUser) {
    echo "ERROR: $correctId not found!\n";
    exit(1);
}
echo "Target user: " . $targetUser['name'] . " ($correctId)\n";

$dir = DATA_DIR . '/observations';
$files = glob($dir . '/*.json');
$totalFixed = 0;
$testRemoved = 0;

foreach ($files as $file) {
    $data = json_decode(file_get_contents($file), true);
    if (!$data) continue;

    $modified = false;

    // Fix wrong user_id
    foreach ($data as &$obs) {
        if (($obs['user_id'] ?? '') === $wrongId) {
            $obs['user_id'] = $correctId;
            $obs['user_name'] = $targetUser['name'];
            $obs['user_avatar'] = $targetUser['avatar'] ?? '';
            $modified = true;
            $totalFixed++;
        }
    }
    unset($obs);

    // Remove test observations
    $before = count($data);
    $data = array_values(array_filter($data, function ($o) {
        return !str_starts_with($o['id'] ?? '', 'test_');
    }));
    $testRemoved += $before - count($data);
    if ($before !== count($data)) $modified = true;

    if ($modified) {
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo "Updated " . basename($file) . "\n";
    }
}

echo "\nFixed $totalFixed observations ($wrongId -> $correctId)\n";
echo "Removed $testRemoved test observations\n";

// Now show final distribution
$all = DataStore::fetchAll('observations');
$byUser = [];
foreach ($all as $obs) {
    $uid = $obs['user_id'] ?? 'NO_ID';
    if (!isset($byUser[$uid])) $byUser[$uid] = 0;
    $byUser[$uid]++;
}
arsort($byUser);
echo "\nFinal user distribution:\n";
foreach ($byUser as $uid => $count) {
    echo "  $uid: $count\n";
}
echo "Total: " . count($all) . "\n";
echo "Done!\n";
