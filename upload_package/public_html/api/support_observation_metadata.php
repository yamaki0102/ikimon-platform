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

if ($observationId === '' || $proposalId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'observation_id and proposal_id are required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$observation = DataStore::findById('observations', $observationId);
if (!$observation) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Observation not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$result = ObservationMeta::supportMetadataProposal($observation, $proposalId, $user);
if (!$result['changed']) {
    http_response_code(422);
    $messages = [
        'resolved' => 'この提案はすでに処理済みです',
        'duplicate' => 'この提案にはすでに賛成しています',
        'self' => '自分の提案には賛成できません',
        'missing' => '提案が見つかりませんでした',
    ];
    echo json_encode([
        'success' => false,
        'message' => $messages[$result['reason']] ?? '処理できませんでした',
        'reason' => $result['reason'],
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
    'message' => $result['reason'] === 'auto_accepted'
        ? 'コミュニティ支持が集まり、この提案が採用されました'
        : 'この提案に賛成しました',
    'reason' => $result['reason'],
    'summary' => $result['summary'] ?? null,
    'ai_requeued' => $aiPlan !== null,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
