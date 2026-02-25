<?php

/**
 * デモデータ全体監査スクリプト
 */
require_once __DIR__ . '/../upload_package/config/config.php';
require_once __DIR__ . '/../upload_package/libs/DataStore.php';

echo "=== デモデータ監査 ===\n\n";

// 1. Observations
echo "--- Observations ---\n";
$obs = DataStore::get('observations');
echo "Total: " . count($obs) . "\n";
$seeds = array_filter($obs, function ($o) {
    return !empty($o['is_seed']);
});
echo "Seed (is_seed=true): " . count($seeds) . "\n";
$demoUserObs = array_filter($obs, function ($o) {
    $uid = $o['user_id'] ?? '';
    return strpos($uid, 'seed_') !== false || strpos($uid, 'demo_') !== false;
});
echo "Demo user observations: " . count($demoUserObs) . "\n";
$seedUserIds = array_unique(array_map(function ($o) {
    return $o['user_id'] ?? 'unknown';
}, $seeds));
echo "Seed user IDs: " . implode(', ', $seedUserIds) . "\n";

// 2. Users
echo "\n--- Users ---\n";
$usersFile = DATA_DIR . '/users.json';
if (file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true) ?: [];
    echo "Total users: " . count($users) . "\n";
    foreach ($users as $u) {
        $id = $u['id'] ?? '?';
        $name = $u['name'] ?? '?';
        $email = $u['email'] ?? '?';
        $role = $u['role'] ?? 'user';
        echo "  - {$id}: {$name} ({$email}) [{$role}]\n";
    }
} else {
    echo "users.json not found\n";
}

// 3. Sites
echo "\n--- Sites ---\n";
$sitesDir = DATA_DIR . '/sites';
if (is_dir($sitesDir)) {
    $siteFiles = glob($sitesDir . '/*.json');
    echo "Total sites: " . count($siteFiles) . "\n";
    foreach ($siteFiles as $sf) {
        $site = json_decode(file_get_contents($sf), true);
        $id = $site['id'] ?? basename($sf, '.json');
        $name = $site['name'] ?? '?';
        echo "  - {$id}: {$name}\n";
    }
} else {
    echo "No sites directory\n";
}

// 4. Identifications
echo "\n--- Identifications ---\n";
$idFile = DATA_DIR . '/identifications.json';
if (file_exists($idFile)) {
    $ids = json_decode(file_get_contents($idFile), true) ?: [];
    echo "Total identifications: " . count($ids) . "\n";
} else {
    echo "identifications.json not found\n";
}

// 5. Events
echo "\n--- Events ---\n";
$evFile = DATA_DIR . '/events.json';
if (file_exists($evFile)) {
    $events = json_decode(file_get_contents($evFile), true) ?: [];
    echo "Total events: " . count($events) . "\n";
} else {
    echo "events.json not found\n";
}

// 6. Tracks / Field sessions
echo "\n--- Tracks ---\n";
$trackFile = DATA_DIR . '/tracks.json';
if (file_exists($trackFile)) {
    $tracks = json_decode(file_get_contents($trackFile), true) ?: [];
    echo "Total tracks: " . count($tracks) . "\n";
} else {
    echo "tracks.json not found\n";
}

// 7. List all data files
echo "\n--- All data files ---\n";
$allFiles = glob(DATA_DIR . '/*.json');
foreach ($allFiles as $f) {
    $data = json_decode(file_get_contents($f), true);
    $count = is_array($data) ? count($data) : 'N/A';
    echo "  " . basename($f) . ": " . $count . " records\n";
}

// Data directories
$dataDirs = glob(DATA_DIR . '/*', GLOB_ONLYDIR);
foreach ($dataDirs as $d) {
    $files = glob($d . '/*.json');
    echo "  " . basename($d) . "/: " . count($files) . " files\n";
}

echo "\n=== 監査完了 ===\n";
