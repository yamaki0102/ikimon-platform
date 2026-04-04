<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/OAuthClient.php';
require_once __DIR__ . '/../libs/AppOAuthStateStore.php';

Auth::init();

$provider = $_GET['provider'] ?? '';
$installId = trim((string)($_GET['install_id'] ?? ''));
$platform = trim((string)($_GET['platform'] ?? 'android'));
$appVersion = trim((string)($_GET['app_version'] ?? 'unknown'));
$returnUri = trim((string)($_GET['return_uri'] ?? 'ikimonfieldscan://auth/callback'));

if (!in_array($provider, ['google', 'twitter'], true)) {
    header('Location: ikimonfieldscan://auth/callback?error=invalid_provider');
    exit;
}

if (!isOAuthEnabled($provider)) {
    header('Location: ikimonfieldscan://auth/callback?error=oauth_not_configured');
    exit;
}

if (!preg_match('#^ikimonfieldscan://auth/callback#', $returnUri)) {
    $returnUri = 'ikimonfieldscan://auth/callback';
}

try {
    $state = AppOAuthStateStore::issue([
        'provider' => $provider,
        'install_id' => $installId,
        'platform' => $platform,
        'app_version' => $appVersion,
        'return_uri' => $returnUri,
    ]);

    if ($provider !== 'google') {
        header('Location: ' . $returnUri . '?error=unsupported_provider');
        exit;
    }

    $authUrl = OAuthClient::getGoogleAuthUrlForState($state);
    header("Location: {$authUrl}");
    exit;
} catch (\Throwable $e) {
    error_log('[App OAuth Init Error] ' . $e->getMessage());
    header('Location: ' . $returnUri . '?error=oauth_init_failed');
    exit;
}
