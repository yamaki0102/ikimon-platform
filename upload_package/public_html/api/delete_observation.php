<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/ObservationMeta.php';

Auth::init();
CSRF::validateRequest();

$currentUser = Auth::user();
$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!is_array($input)) {
    $input = $_POST;
}

$observationId = trim((string)($input['observation_id'] ?? ''));
if ($observationId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'observation_id is required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$observation = DataStore::findById('observations', $observationId);
if (!$observation) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => '観察が見つかりません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (!ObservationMeta::canDeleteObservation($observation, $currentUser)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'この観察を削除する権限がありません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$deleted = DataStore::deleteById('observations', $observationId);
if (!$deleted) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '観察データを削除できませんでした'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$photoDir = app_upload_path('photos/' . $observationId);
if (is_dir($photoDir)) {
    foreach (glob($photoDir . '/*') ?: [] as $file) {
        if (is_file($file)) {
            @unlink($file);
        }
    }
    @rmdir($photoDir);
}

if (Auth::isGuest()) {
    Auth::removeGuestPost($observationId);
}

echo json_encode([
    'success' => true,
    'message' => '観察を削除しました',
    'observation_id' => $observationId,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
