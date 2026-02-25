<?php

/**
 * 全ユーザー一覧出力
 */
require_once __DIR__ . '/../upload_package/config/config.php';

$usersFile = DATA_DIR . '/users.json';
$users = json_decode(file_get_contents($usersFile), true) ?: [];

echo "Total users: " . count($users) . "\n\n";
echo str_pad("ID", 28) . str_pad("Name", 20) . str_pad("Email", 35) . str_pad("Role", 10) . "ObsCount\n";
echo str_repeat("-", 120) . "\n";

// Count observations per user
require_once __DIR__ . '/../upload_package/libs/DataStore.php';
$obs = DataStore::get('observations');
$obsByUser = [];
foreach ($obs as $o) {
    $uid = $o['user_id'] ?? 'unknown';
    $obsByUser[$uid] = ($obsByUser[$uid] ?? 0) + 1;
}

foreach ($users as $u) {
    $id = $u['id'] ?? '?';
    $name = $u['name'] ?? '?';
    $email = $u['email'] ?? '?';
    $role = $u['role'] ?? 'user';
    $oc = $obsByUser[$id] ?? 0;
    echo str_pad($id, 28) . str_pad($name, 20) . str_pad($email, 35) . str_pad($role, 10) . $oc . "\n";
}

echo "\n--- Observations without user match ---\n";
$allUserIds = array_column($users, 'id');
$orphanObs = [];
foreach ($obs as $o) {
    $uid = $o['user_id'] ?? 'unknown';
    if (!in_array($uid, $allUserIds)) {
        $orphanObs[$uid] = ($orphanObs[$uid] ?? 0) + 1;
    }
}
foreach ($orphanObs as $uid => $count) {
    echo "  {$uid}: {$count} observations\n";
}
