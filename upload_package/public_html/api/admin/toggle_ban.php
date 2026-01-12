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
$banned = isset($input['banned']) ? (bool)$input['banned'] : null;

if (!$id || $banned === null) {
    echo json_encode(['success' => false, 'message' => 'Invalid payload']);
    exit;
}

$user = UserStore::findById($id);
if (!$user || !empty($user['is_seed'])) {
    echo json_encode(['success' => false, 'message' => 'User not found']);
    exit;
}

$updated = UserStore::update($id, ['banned' => $banned]);
echo json_encode(['success' => (bool)$updated, 'data' => $updated]);
