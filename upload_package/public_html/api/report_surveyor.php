<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/SurveyorManager.php';

Auth::init();
CSRF::validateRequest();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid method'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (!Auth::isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'ログインが必要です。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$surveyorId = trim((string)($input['surveyor_id'] ?? ''));
$reason = trim((string)($input['reason'] ?? 'other'));
$details = mb_substr(trim((string)($input['details'] ?? '')), 0, 500);

if ($surveyorId === '' || !SurveyorManager::findPublicSurveyorById($surveyorId)) {
    echo json_encode(['success' => false, 'message' => '対象の調査員が見つかりません。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$flags = DataStore::get('flags');
$flags[] = [
    'id' => uniqid('flag_'),
    'reporter_id' => Auth::user()['id'],
    'target_type' => 'surveyor_profile',
    'target_id' => $surveyorId,
    'reason' => $reason,
    'details' => $details,
    'status' => 'pending',
    'created_at' => date('Y-m-d H:i:s'),
];

DataStore::save('flags', $flags);

echo json_encode(['success' => true, 'message' => '通報を受け付けました。ありがとうございます。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
