<?php
/**
 * Fix all observation data across legacy + partitions for account merge.
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Cache.php';
require_once __DIR__ . '/../libs/DataStore.php';

$mergeIds = ['user_69bd41455eeba', 'user_69bc926c2eca4'];
$targetId = 'user_admin_001';
$targetName = 'yamakit -A';
$targetAvatar = 'uploads/avatars/user_69bd41455eeba_1774012735.webp';

$totalChanged = 0;

// Fix legacy file
$legacyPath = DATA_DIR . '/observations.json';
if (file_exists($legacyPath)) {
    $obs = json_decode(file_get_contents($legacyPath), true) ?: [];
    $c = 0;
    foreach ($obs as $i => $o) {
        if (in_array($o['user_id'] ?? '', $mergeIds)) {
            $obs[$i]['user_id'] = $targetId;
            $obs[$i]['user_name'] = $targetName;
            $obs[$i]['user_avatar'] = $targetAvatar;
            $c++;
        }
    }
    if ($c > 0) {
        file_put_contents($legacyPath, json_encode($obs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }
    echo "Legacy: fixed $c\n";
    $totalChanged += $c;
}

// Fix all partitions
$dir = DATA_DIR . '/observations';
if (is_dir($dir)) {
    foreach (glob($dir . '/*.json') as $file) {
        if (strpos($file, '.bak') !== false) continue;
        $data = json_decode(file_get_contents($file), true) ?: [];
        if (!is_array($data)) continue;
        $c = 0;
        foreach ($data as $i => $o) {
            if (in_array($o['user_id'] ?? '', $mergeIds)) {
                $data[$i]['user_id'] = $targetId;
                $data[$i]['user_name'] = $targetName;
                $data[$i]['user_avatar'] = $targetAvatar;
                $c++;
            }
        }
        if ($c > 0) {
            file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }
        echo basename($file) . ": fixed $c\n";
        $totalChanged += $c;
    }
}

// Clear all cache
Cache::Init();
$cacheDir = DATA_DIR . '/cache';
if (is_dir($cacheDir)) {
    foreach (glob($cacheDir . '/*') as $f) @unlink($f);
    echo "Cache cleared\n";
}

echo "\nTotal fixed: $totalChanged\n";

// Verify
$all = DataStore::fetchAll('observations');
$adminCount = 0;
foreach ($all as $o) {
    if (($o['user_id'] ?? '') === $targetId) $adminCount++;
}
echo "user_admin_001 observations: $adminCount\n";
