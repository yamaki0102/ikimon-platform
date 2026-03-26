<?php
require_once __DIR__ . '/../../../libs/Auth.php';
require_once __DIR__ . '/../../../libs/UserStore.php';
require_once __DIR__ . '/../../../libs/DataStore.php';
require_once __DIR__ . '/../../../libs/SurveyorManager.php';

Auth::init();
Auth::requireRole('Admin');
header('Content-Type: application/json; charset=utf-8');

$users = UserStore::getAll(false);
$observations = DataStore::fetchAll('observations');
$observationCounts = [];
foreach ($observations as $obs) {
    $userId = $obs['user_id'] ?? '';
    if ($userId === '') {
        continue;
    }
    $observationCounts[$userId] = ($observationCounts[$userId] ?? 0) + 1;
}

$clean = array_map(function($u) use ($observationCounts) {
    $userId = $u['id'] ?? null;
    $adminMeta = SurveyorManager::getAdminMeta($u);
    return [
        'id' => $userId,
        'name' => $u['name'] ?? '',
        'email' => $u['email'] ?? '',
        'role' => $u['role'] ?? Auth::getRole($u),
        'rank' => $u['rank'] ?? Auth::getRankLabel($u),
        'avatar' => $u['avatar'] ?? '',
        'created_at' => $u['created_at'] ?? null,
        'last_login_at' => $u['last_login_at'] ?? null,
        'banned' => !empty($u['banned']),
        'observation_count' => $userId ? ($observationCounts[$userId] ?? 0) : 0,
        'surveyor_status' => SurveyorManager::getStatus($u),
        'surveyor_public_visible' => SurveyorManager::getProfile($u)['public_visible'],
        'surveyor_admin' => $adminMeta,
        'surveyor_status_history' => SurveyorManager::getStatusHistory($u),
    ];
}, $users);

echo json_encode(['success' => true, 'data' => $clean], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
