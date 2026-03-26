<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';
require_once __DIR__ . '/../../libs/UserStore.php';
require_once __DIR__ . '/../../libs/SurveyorManager.php';

Auth::init();
CSRF::validateRequest();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid method'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$user = Auth::user();
if (!$user || !SurveyorManager::isApproved($user)) {
    echo json_encode(['success' => false, 'message' => '調査員として承認されたユーザーのみ編集できます。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$profile = SurveyorManager::normalizeProfileInput([
    'headline' => $input['headline'] ?? '',
    'summary' => $input['summary'] ?? '',
    'areas' => $input['areas_text'] ?? '',
    'specialties' => $input['specialties_text'] ?? '',
    'price_band' => $input['price_band'] ?? '',
    'available_days' => $input['available_days_text'] ?? '',
    'travel_range' => $input['travel_range'] ?? '',
    'contact_label' => $input['contact_label'] ?? '',
    'contact_url' => $input['contact_url'] ?? '',
    'contact_notes' => $input['contact_notes'] ?? '',
    'achievements' => $input['achievements'] ?? '',
    'availability' => $input['availability'] ?? '',
    'public_visible' => !empty($input['public_visible']),
]);

$updated = UserStore::update($user['id'], [
    'surveyor_profile' => $profile
]);

if (!$updated) {
    echo json_encode(['success' => false, 'message' => '保存に失敗しました。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$sessionUser = $updated;
unset($sessionUser['password_hash']);
Auth::login($sessionUser);

echo json_encode([
    'success' => true,
    'message' => '調査員プロフィールを更新しました。',
    'profile' => SurveyorManager::getProfile($updated),
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
