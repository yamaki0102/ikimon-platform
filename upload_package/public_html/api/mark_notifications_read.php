<?php
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

// POST body から notification_id を取得（省略時は全既読）
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$notifId = $input['notification_id'] ?? null;

if ($notifId) {
    $result = Notification::markRead($user['id'], $notifId);
} else {
    $result = Notification::markAllRead($user['id']);
}

echo json_encode([
    'success' => $result !== false,
    'unread_count' => Notification::getUnreadCount($user['id'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG)
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
