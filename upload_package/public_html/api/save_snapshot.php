<?php
// api/save_snapshot.php
// Reference data snapshot endpoint — Admin only

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';

header('Content-Type: application/json; charset=utf-8');

// === Security: Admin session required ===
Auth::init();
if (!Auth::check() || (Auth::user()['rank'] ?? '') !== 'Admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Admin authentication required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// 1. Get RAW POST data
$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// 2. Define Path
$savePath = ROOT_DIR . '/data/reference_data.json';

// 3. Save File
if (file_put_contents($savePath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG))) {
    echo json_encode([
        'status' => 'success',
        'message' => 'Snapshot deployed to ' . $savePath,
        'count' => count($data)
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write file. Check permissions.'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
}
