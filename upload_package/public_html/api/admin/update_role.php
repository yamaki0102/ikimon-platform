<?php
require_once __DIR__ . '/../../../libs/Auth.php';
require_once __DIR__ . '/../../../libs/UserStore.php';

Auth::init();
Auth::requireRole('Admin');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid method']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$id = $input['id'] ?? '';
$role = $input['role'] ?? '';
$allowed = ['Observer', 'Specialist', 'Analyst', 'Admin'];

if (!$id || !in_array($role, $allowed, true)) {
    echo json_encode(['success' => false, 'message' => 'Invalid payload']);
    exit;
}

$user = UserStore::findById($id);
if (!$user || !empty($user['is_seed'])) {
    echo json_encode(['success' => false, 'message' => 'User not found']);
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
    'rank' => $rankMap[$role] ?? ($user['rank'] ?? '観察者')
]);

echo json_encode(['success' => (bool)$updated, 'data' => $updated]);
