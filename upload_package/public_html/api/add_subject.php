<?php
/**
 * add_subject.php — 観察に新しいsubject（生物）を追加するAPI
 *
 * POST body (JSON):
 *   - observation_id (str): 対象の観察ID
 *   - label (str): subjectのラベル（例: "昆虫", "キノコ"）
 *   - trigger_ai (bool): trueならAI再評価をキューに追加
 */

header('Content-Type: application/json; charset=utf-8');

set_error_handler(function($errno, $errstr, $errfile, $errline) {
    throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
});
set_exception_handler(function($e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
});

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/SubjectHelper.php';
require_once __DIR__ . '/../../libs/CSRF.php';

Auth::init();
$user = Auth::user();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE);
    exit;
}

CSRF::validate();

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON'], JSON_UNESCAPED_UNICODE);
    exit;
}

$observationId = trim($input['observation_id'] ?? '');
$label = trim($input['label'] ?? '');
$triggerAi = (bool)($input['trigger_ai'] ?? false);

if ($observationId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'observation_id is required'], JSON_UNESCAPED_UNICODE);
    exit;
}

$obs = DataStore::findById('observations', $observationId);
if (!$obs) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => '観察が見つかりません'], JSON_UNESCAPED_UNICODE);
    exit;
}

SubjectHelper::ensureSubjects($obs);

$photoIndices = range(0, max(0, count($obs['photos'] ?? []) - 1));
$newSubjectId = SubjectHelper::addSubject($obs, $label ?: null, $photoIndices);

SubjectHelper::syncPrimaryToLegacy($obs);
DataStore::upsert('observations', $obs);

echo json_encode([
    'success' => true,
    'subject_id' => $newSubjectId,
    'subject_count' => SubjectHelper::subjectCount($obs),
    'label' => $label ?: null,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
