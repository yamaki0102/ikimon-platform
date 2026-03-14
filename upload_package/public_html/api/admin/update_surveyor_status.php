<?php
require_once __DIR__ . '/../../../libs/Auth.php';
require_once __DIR__ . '/../../../libs/UserStore.php';
require_once __DIR__ . '/../../../libs/CSRF.php';
require_once __DIR__ . '/../../../libs/SurveyorManager.php';

Auth::init();
CSRF::validateRequest();
Auth::requireRole('Admin');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid method'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$id = $input['id'] ?? '';
$status = $input['status'] ?? SurveyorManager::STATUS_NONE;
$allowed = [
    SurveyorManager::STATUS_NONE,
    SurveyorManager::STATUS_PENDING,
    SurveyorManager::STATUS_APPROVED,
    SurveyorManager::STATUS_SUSPENDED,
];

if (!$id || !in_array($status, $allowed, true)) {
    echo json_encode(['success' => false, 'message' => 'Invalid payload'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$user = UserStore::findById($id);
if (!$user || !empty($user['is_seed'])) {
    echo json_encode(['success' => false, 'message' => 'User not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$profile = SurveyorManager::getProfile($user);
$adminMeta = SurveyorManager::normalizeAdminMeta([
    'application_note' => $input['application_note'] ?? '',
    'interview_date' => $input['interview_date'] ?? '',
    'approval_reason' => $input['approval_reason'] ?? '',
]);
$currentStatus = SurveyorManager::getStatus($user);
$history = SurveyorManager::getStatusHistory($user);
if ($status !== SurveyorManager::STATUS_APPROVED) {
    $profile['public_visible'] = false;
}
if ($currentStatus !== $status) {
    $history[] = SurveyorManager::buildStatusHistoryEntry(
        $currentStatus,
        $status,
        Auth::user(),
        $adminMeta['approval_reason'] !== '' ? $adminMeta['approval_reason'] : $adminMeta['application_note']
    );
}

$updated = UserStore::update($id, [
    'surveyor_status' => $status,
    'surveyor_profile' => $profile,
    'surveyor_admin' => $adminMeta,
    'surveyor_status_history' => $history,
]);

echo json_encode(['success' => (bool)$updated, 'data' => $updated], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
