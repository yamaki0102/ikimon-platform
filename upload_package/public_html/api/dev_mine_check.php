<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';

Auth::init();
Auth::loginById('user_ya_001');
$currentUser = Auth::user();
echo "Logged in as: " . $currentUser['id'] . "\n\n";

$latest = DataStore::getLatest('observations', 10);
foreach ($latest as $obs) {
    if ($obs['user_id'] === 'user_ya_001') {
        echo "Obs ID: " . $obs['id'] . "\n";
        $isMine = isset($obs['user_id']) && isset($currentUser['id']) && (string)$obs['user_id'] === (string)$currentUser['id'];
        echo "Is Mine? " . ($isMine ? 'YES' : 'NO') . "\n";
    }
}
