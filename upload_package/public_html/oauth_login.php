<?php

/**
 * OAuth Login Initiator
 * 
 * login.php からのOAuthボタンクリック → ここでリダイレクトURLを生成 → プロバイダーへ転送
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/AccessGate.php';
require_once __DIR__ . '/../libs/OAuthClient.php';

Auth::init();

$provider = $_GET['provider'] ?? '';

if (!in_array($provider, ['google', 'twitter'], true)) {
    header('Location: login.php?error=invalid_provider');
    exit;
}

if (!isOAuthEnabled($provider)) {
    header('Location: login.php?error=oauth_not_configured');
    exit;
}

if (!empty($_GET['invite_code'])) {
    AccessGate::rememberInviteCode((string)$_GET['invite_code']);
}

try {
    $authUrl = OAuthClient::getAuthUrl($provider);
    header("Location: {$authUrl}");
    exit;
} catch (\Throwable $e) {
    error_log('[OAuth Init Error] ' . $e->getMessage());
    header('Location: login.php?error=oauth_init_failed');
    exit;
}
