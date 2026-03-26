<?php
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';

header('Content-Type: application/json; charset=UTF-8');

Auth::init();
$user = Auth::user();

if (!$user) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$subscription = $input['subscription'] ?? null;

if (!$subscription || empty($subscription['endpoint'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid subscription']);
    exit;
}

// Store subscription per user
$dir = DATA_DIR . '/push_subscriptions';
if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}

$file = $dir . '/' . $user['id'] . '.json';
$existing = [];
if (file_exists($file)) {
    $existing = json_decode(file_get_contents($file), true) ?: [];
}

// Avoid duplicates by endpoint
$endpoints = array_column($existing, 'endpoint');
if (!in_array($subscription['endpoint'], $endpoints)) {
    $existing[] = $subscription;
    // Keep max 5 subscriptions per user (multiple devices)
    if (count($existing) > 5) {
        $existing = array_slice($existing, -5);
    }
    file_put_contents($file, json_encode($existing, JSON_UNESCAPED_UNICODE), LOCK_EX);
}

echo json_encode(['ok' => true]);
