<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/Notification.php';

Auth::init();
$user = Auth::user();

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Login required']);
    exit;
}

$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 5;
$notifications = Notification::getRecent($user['id'], $limit);
$unreadCount = Notification::getUnreadCount($user['id']);

echo json_encode([
    'success' => true,
    'data' => $notifications,
    'unread_count' => $unreadCount
]);
