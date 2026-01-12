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

if (Notification::markAllRead($user['id'])) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false]);
}
