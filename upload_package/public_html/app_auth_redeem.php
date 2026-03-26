<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/AuthBridge.php';

Auth::init();

$token = trim($_GET['token'] ?? '');
$result = AuthBridge::loginWithToken($token);

if (!$result) {
    header('Location: /login.php?error=oauth&msg=' . urlencode('アプリへのログイン引き継ぎに失敗しました。もう一度お試しください。'));
    exit;
}

$redirect = $result['redirect'] ?? 'index.php';
header('Location: /' . ltrim($redirect, '/'));
exit;
