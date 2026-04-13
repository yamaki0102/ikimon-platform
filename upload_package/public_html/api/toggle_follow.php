<?php

/**
 * API: Toggle Follow (user or site)
 * POST { target_id, type: 'users'|'sites', action: 'follow'|'unfollow' }
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/FollowManager.php';
require_once __DIR__ . '/../../libs/CSRF.php';

header('Content-Type: application/json; charset=utf-8');

Auth::init();
CSRF::validateRequest();
$user = Auth::user();

if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$targetId = $input['target_id'] ?? '';
$type = $input['type'] ?? 'users';
$action = $input['action'] ?? 'follow';

if (empty($targetId)) {
    http_response_code(400);
    echo json_encode(['error' => 'target_id is required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (!in_array($type, ['users', 'sites'])) {
    http_response_code(400);
    echo json_encode(['error' => 'type must be users or sites'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if ($action === 'follow') {
    $result = FollowManager::follow($user['id'], $targetId, $type);
} else {
    $result = FollowManager::unfollow($user['id'], $targetId, $type);
}

$isFollowing = FollowManager::isFollowing($user['id'], $targetId, $type);

echo json_encode([
    'success' => $result,
    'is_following' => $isFollowing,
    'action' => $action,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
