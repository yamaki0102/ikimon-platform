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

$changes = ObservationMeta::extractProposableChanges($input, $observation);
if ($changes === []) {
    echo json_encode([
        'success' => true,
        'message' => '提案する変更がありませんでした',
        'observation_id' => $observationId,
        'mode' => 'noop',
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$mode = 'proposal';
if (ObservationMeta::canEditObservation($observation, $user) || ObservationMeta::canDirectlyModerateMetadata($user)) {
    $normalized = ObservationMeta::normalizeEditableInput($input, $observation);
    $changed = ObservationMeta::applyDirectEdit($observation, $normalized, $user, (string)($input['proposal_note'] ?? 'metadata_direct_update'));
    if ($changed) {
        $mode = 'direct';
    }
} else {
    ObservationMeta::addMetadataProposal($observation, $changes, $user, (string)($input['proposal_note'] ?? ''));
}

DataStore::upsert('observations', $observation);
ObservationRecalcQueue::enqueue($observationId, 'observation_refreshed');

$aiPlan = AiAssessmentQueue::planForObservation($observation, 'observation_refreshed');
if ($aiPlan !== null) {
    AiAssessmentQueue::enqueue($observationId, (string)$aiPlan['reason'], $aiPlan);
}

echo json_encode([
    'success' => true,
    'message' => $mode === 'direct' ? '構造化情報を更新しました' : '構造化情報の提案を追加しました',
    'observation_id' => $observationId,
    'mode' => $mode,
    'changes' => $changes,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
