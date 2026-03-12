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
$proposalId = trim((string)($input['proposal_id'] ?? ''));
$action = trim((string)($input['action'] ?? ''));
$resolutionNote = (string)($input['note'] ?? '');

if ($observationId === '' || $proposalId === '' || !in_array($action, ['accept', 'reject'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'observation_id, proposal_id, action are required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$observation = DataStore::findById('observations', $observationId);
if (!$observation) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Observation not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (!ObservationMeta::canReviewMetadataProposals($observation, $user)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'この提案を処理する権限がありません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$changed = ObservationMeta::reviewMetadataProposal($observation, $proposalId, $action, $user, $resolutionNote);
if (!$changed) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => '処理できる提案が見つかりませんでした'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
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
    'message' => $action === 'accept' ? '提案を採用しました' : '提案を却下しました',
    'action' => $action,
    'observation_id' => $observationId,
    'proposal_id' => $proposalId,
    'ai_requeued' => $aiPlan !== null,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
