<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/UserStore.php';

Auth::init();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid method']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (!$email || !$password) {
    echo json_encode(['success' => false, 'message' => 'Email and password required']);
    exit;
}

$user = UserStore::findByEmail($email);
if (!$user || empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
    exit;
}

if (!empty($user['banned'])) {
    echo json_encode(['success' => false, 'message' => 'Account disabled']);
    exit;
}

$loginUser = $user;
unset($loginUser['password_hash']);
Auth::login($loginUser);
UserStore::update($user['id'], ['last_login_at' => date('Y-m-d H:i:s')]);

echo json_encode(['success' => true, 'user' => $loginUser]);
