<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/UserStore.php';
require_once __DIR__ . '/../../libs/RateLimiter.php';

Auth::init();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid method'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

// Brute-force protection: 5 attempts per minute per IP+email combo
$rateLimitKey = 'login_' . md5(($email ?: 'unknown') . '_' . ($_SERVER['REMOTE_ADDR'] ?? ''));
if (!RateLimiter::check($rateLimitKey, 5, 60)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'ログイン試行回数が多すぎます。1分後に再試行してください。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (!$email || !$password) {
    echo json_encode(['success' => false, 'message' => 'Email and password required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$user = UserStore::findByEmail($email);
if (!$user || empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid credentials'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (!empty($user['banned'])) {
    echo json_encode(['success' => false, 'message' => 'Account disabled'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$loginUser = $user;
unset($loginUser['password_hash']);
Auth::login($loginUser);
UserStore::update($user['id'], ['last_login_at' => date('Y-m-d H:i:s')]);

echo json_encode(['success' => true, 'user' => $loginUser], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
