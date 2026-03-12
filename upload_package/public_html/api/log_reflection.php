<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';
require_once __DIR__ . '/../../libs/HabitEngine.php';

Auth::init();
CSRF::validateRequest();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$currentUser = Auth::user();
if (!$currentUser) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$note = (string)($input['note'] ?? '');
$source = (string)($input['source'] ?? '');

try {
    $entry = HabitEngine::recordReflection($currentUser['id'], $note, [
        'source' => $source,
    ]);
    $todayState = HabitEngine::getTodayState($currentUser['id']);

    echo json_encode([
        'success' => true,
        'entry' => $entry,
        'today' => [
            'complete' => !empty($todayState['today_complete']),
            'types' => $todayState['today_types'] ?? [],
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
} catch (InvalidArgumentException $e) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
}
