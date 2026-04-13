<?php

/**
 * API: Create a new My Field
 * POST {name, lat, lng, radius, biome}
 */
require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/MyFieldManager.php';
require_once ROOT_DIR . '/libs/CSRF.php';

header('Content-Type: application/json; charset=utf-8');

Auth::init();
CSRF::validateRequest();
$user = Auth::user();

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Parse JSON body or form data
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$name   = trim($input['name'] ?? '');
$lat    = (float)($input['lat'] ?? 0);
$lng    = (float)($input['lng'] ?? 0);
$radius = (int)($input['radius'] ?? 500);
$biome  = trim($input['biome'] ?? 'unknown');

// Validation
$errors = [];
if (empty($name)) $errors[] = 'フィールド名は必須です';
if ($lat < -90 || $lat > 90 || $lat == 0) $errors[] = '緯度が不正です';
if ($lng < -180 || $lng > 180 || $lng == 0) $errors[] = '経度が不正です';
if ($radius < 50 || $radius > 5000) $errors[] = '半径は50〜5000mで指定してください';

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => implode(', ', $errors)], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

try {
    $field = MyFieldManager::create($user['id'], $name, $lat, $lng, $radius, $biome);
    echo json_encode([
        'success' => true,
        'field'   => $field,
        'message' => 'フィールドを作成しました'
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
} catch (Exception $e) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error'   => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
}
