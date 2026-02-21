<?php

/**
 * get_notifications.php — 通知取得API (v2)
 * 
 * GET: ログインユーザーの通知一覧を返す
 * Params: limit (default 20), offset (default 0)
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/Notification.php';

Auth::init();
$user = Auth::user();

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$limit = min(max((int)($_GET['limit'] ?? 20), 1), 100);
$offset = max((int)($_GET['offset'] ?? 0), 0);

$notifications = Notification::getRecent($user['id'], $limit);
$unreadCount = Notification::getUnreadCount($user['id']);

echo json_encode([
    'success' => true,
    'notifications' => array_values($notifications, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG),
    'unread_count' => $unreadCount,
    'total' => count($notifications)
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
