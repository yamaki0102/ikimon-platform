<?php
require_once __DIR__ . '/../../../libs/Auth.php';
require_once __DIR__ . '/../../../libs/UserStore.php';
require_once __DIR__ . '/../../../libs/CSRF.php';

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
$role = $input['role'] ?? '';
$allowed = ['Observer', 'Specialist', 'Analyst', 'Admin'];

if (!$id || !in_array($role, $allowed, true)) {
    echo json_encode(['success' => false, 'message' => 'Invalid payload'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$user = UserStore::findById($id);
if (!$user || !empty($user['is_seed'])) {
    echo json_encode(['success' => false, 'message' => 'User not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$rankMap = [
    'Observer' => '観察者',
    'Specialist' => '熟練者',
    'Analyst' => '認定研究者',
    'Admin' => '管理者'
];

$updated = UserStore::update($id, [
    'role' => $role,
    'rank' => $rankMap[$role]
]);

echo json_encode(['success' => (bool)$updated, 'data' => $updated], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
