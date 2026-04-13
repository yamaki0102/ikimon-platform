<?php
require_once __DIR__ . '/../../config/config.php'; // Correct path to config
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';

Auth::init();
CSRF::validateRequest();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (!Auth::isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Login required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$target_type = $input['target_type'] ?? '';
$target_id = $input['target_id'] ?? '';
$reason = $input['reason'] ?? '';

if (!$target_type || !$target_id || !$reason) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$report = [
    'id' => uniqid('flag_'),
    'reporter_id' => Auth::user()['id'],
    'target_type' => $target_type,
    'target_id' => $target_id,
    'reason' => $reason,
    'status' => 'pending', // pending, reviewed, dismissed
    'created_at' => date('Y-m-d H:i:s')
];

// Save to flags.json
DataStore::save('flags', $report);

echo json_encode(['success' => true, 'message' => 'Report submitted'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
