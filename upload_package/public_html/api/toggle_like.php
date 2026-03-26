<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/Notification.php';

Auth::init();
header('Content-Type: application/json; charset=utf-8');

if (!Auth::isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'Login required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$obsId = $input['id'] ?? '';
$user = Auth::user();

if (!$obsId) {
    echo json_encode(['success' => false, 'message' => 'Missing ID'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

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

    // Send notification to observation owner (not self)
    $obs = DataStore::findById('observations', $obsId);
    if ($obs && isset($obs['user_id']) && $obs['user_id'] !== $userId) {
        Notification::sendAmbient(
            $obs['user_id'],
            Notification::TYPE_FOOTPRINT,
            '足あとが残された 👣',
            $user['name'] . ' さんがあなたの記録に足あとを残しました。',
            'observation_detail.php?id=' . $obsId
        );
    }
}

file_put_contents($likeFile, json_encode($likes, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG), LOCK_EX);

echo json_encode(['success' => true, 'action' => $action, 'count' => count($likes)], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
