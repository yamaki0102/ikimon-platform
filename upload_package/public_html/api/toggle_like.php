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
$reactionType = $input['reaction'] ?? 'like';
$user = Auth::user();

// Validate reaction type
$allowedReactions = ['like', 'beautiful', 'cute'];
if (!in_array($reactionType, $allowedReactions, true)) {
    $reactionType = 'like';
}

if (!$obsId) {
    echo json_encode(['success' => false, 'message' => 'Missing ID'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$likeFile = DATA_DIR . '/likes/' . $obsId . '.json';
if (!file_exists(dirname($likeFile))) {
    mkdir(dirname($likeFile), 0777, true);
}

$raw = file_exists($likeFile) ? json_decode(file_get_contents($likeFile), true) : [];
$userId = $user['id'];

// Migrate old format (flat array) to new format
if (isset($raw[0]) && is_string($raw[0])) {
    $oldUsers = $raw;
    $reactions = [];
    foreach ($oldUsers as $u) $reactions[$u] = 'like';
    $raw = ['users' => $oldUsers, 'reactions' => $reactions];
} elseif (!isset($raw['users'])) {
    $raw = ['users' => [], 'reactions' => []];
}

$users = $raw['users'];
$reactions = $raw['reactions'];

$action = 'liked';
$currentReaction = $reactions[$userId] ?? null;

if (in_array($userId, $users, true)) {
    if ($currentReaction === $reactionType) {
        // Same reaction → unlike (toggle off)
        $users = array_values(array_diff($users, [$userId]));
        unset($reactions[$userId]);
        $action = 'unliked';
    } else {
        // Different reaction → change
        $reactions[$userId] = $reactionType;
        $action = 'changed';
    }
} else {
    // New reaction
    $users[] = $userId;
    $reactions[$userId] = $reactionType;
    $action = 'liked';

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

$data = ['users' => array_values($users), 'reactions' => (object)$reactions];
file_put_contents($likeFile, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG), LOCK_EX);

// Build summary
$summary = [];
foreach ($reactions as $uid => $r) {
    $summary[$r] = ($summary[$r] ?? 0) + 1;
}

$myReaction = ($action !== 'unliked') ? ($reactions[$userId] ?? null) : null;

echo json_encode([
    'success' => true,
    'action' => $action,
    'count' => count($users),
    'my_reaction' => $myReaction,
    'summary' => (object)$summary,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
