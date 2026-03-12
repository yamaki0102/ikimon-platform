<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/ObservationMeta.php';
require_once __DIR__ . '/../../libs/ObservationRecalcQueue.php';
require_once __DIR__ . '/../../libs/AiAssessmentQueue.php';

Auth::init();
CSRF::validateRequest();

$user = Auth::user();
if (!$user) {
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

$observationId = trim((string)($input['observation_id'] ?? ''));
if ($observationId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'observation_id is required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$observation = DataStore::findById('observations', $observationId);
if (!$observation) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Observation not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (!ObservationMeta::canEditObservation($observation, $user)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'この観察を編集する権限がありません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$normalized = ObservationMeta::normalizeEditableInput($input, $observation);
$changed = ObservationMeta::applyDirectEdit($observation, $normalized, $user, (string)($input['edit_note'] ?? ''));

if (!$changed) {
    echo json_encode([
        'success' => true,
        'message' => '変更はありませんでした',
        'observation_id' => $observationId,
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

DataStore::upsert('observations', $observation);
ObservationRecalcQueue::enqueue($observationId, 'observation_refreshed');

$aiPlan = AiAssessmentQueue::planForObservation($observation, 'observation_refreshed');
if ($aiPlan !== null) {
    AiAssessmentQueue::enqueue($observationId, (string)$aiPlan['reason'], $aiPlan);
}

echo json_encode([
    'success' => true,
    'message' => '観察を更新しました',
    'observation_id' => $observationId,
    'ai_requeued' => $aiPlan !== null,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
