<?php

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/UserStore.php';
require_once ROOT_DIR . '/libs/RateLimiter.php';
require_once ROOT_DIR . '/libs/AppAuthTokenStore.php';
require_once ROOT_DIR . '/libs/FieldScanInstallRegistry.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST method required.', 405);
}

$body = api_json_body();
$email = strtolower(trim((string)($body['email'] ?? '')));
$password = (string)($body['password'] ?? '');
$installId = trim((string)($body['install_id'] ?? ''));

$rateLimitKey = 'app_login_' . md5(($email ?: 'unknown') . '_' . ($_SERVER['REMOTE_ADDR'] ?? ''));
if (!RateLimiter::check($rateLimitKey, 5, 60)) {
    api_error('ログイン試行回数が多すぎます。1分後に再試行してください。', 429);
}

if ($email === '' || $password === '') {
    api_error('メールアドレスとパスワードが必要です。', 400);
}

$user = UserStore::findByEmail($email);
if (!$user || empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
    api_error('メールアドレスかパスワードが違います。', 401);
}

if (!empty($user['banned'])) {
    api_error('このアカウントは利用停止中です。', 403);
}

UserStore::update($user['id'], ['last_login_at' => date('Y-m-d H:i:s')]);

if ($installId !== '') {
    FieldScanInstallRegistry::register([
        'install_id' => $installId,
        'device' => (string)($body['device'] ?? 'unknown'),
        'platform' => (string)($body['platform'] ?? 'android'),
        'app_version' => (string)($body['app_version'] ?? 'unknown'),
    ], $user);
}

$issued = AppAuthTokenStore::issue($user['id'], $installId !== '' ? $installId : null);
$responseUser = $user;
unset($responseUser['password_hash']);

api_success([
    'token' => $issued['token'],
    'expires_at' => $issued['expires_at'],
    'user' => $responseUser,
]);
