<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';

Auth::init();
header('Content-Type: application/json');

if (!Auth::isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'Login required']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$obsId = $input['id'] ?? '';
$user = Auth::user();

if (!$obsId) {
    echo json_encode(['success' => false, 'message' => 'Missing ID']);
    exit;
}

// In V3, we might use a separate 'likes' table/store to avoid locking the observation file.
// For V2.5/MVP, we'll append to the observation record or use a separate index.
// Let's use a separate Index for speed and concurrency safety (Indexer.php-like approach).

$likeFile = DATA_DIR . '/likes/' . $obsId . '.json';
if (!file_exists(dirname($likeFile))) {
    mkdir(dirname($likeFile), 0777, true);
}

$likes = file_exists($likeFile) ? json_decode(file_get_contents($likeFile), true) : [];
$userId = $user['id'];

$action = 'liked';
if (in_array($userId, $likes)) {
    // Unlike
    $likes = array_values(array_diff($likes, [$userId]));
    $action = 'unliked';
} else {
    // Like
    $likes[] = $userId;
}

file_put_contents($likeFile, json_encode($likes));

echo json_encode(['success' => true, 'action' => $action, 'count' => count($likes)]);
