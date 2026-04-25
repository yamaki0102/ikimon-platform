<?php

/**
 * OAuth 2.0 Configuration
 * 
 * Google: https://console.cloud.google.com/apis/credentials
 * X (Twitter): https://developer.x.com/en/portal/dashboard
 * 
 * ⚠️ 本番デプロイ前に CLIENT_ID / CLIENT_SECRET を設定すること
 */

// Google OAuth 2.0
if (!defined('GOOGLE_CLIENT_ID'))     define('GOOGLE_CLIENT_ID', getenv('GOOGLE_CLIENT_ID') ?: '');
if (!defined('GOOGLE_CLIENT_SECRET')) define('GOOGLE_CLIENT_SECRET', getenv('GOOGLE_CLIENT_SECRET') ?: '');
define('GOOGLE_REDIRECT_URI', BASE_URL . '/oauth_callback.php?provider=google');

// X (Twitter) OAuth 2.0
if (!defined('TWITTER_CLIENT_ID'))     define('TWITTER_CLIENT_ID', getenv('TWITTER_CLIENT_ID') ?: '');
if (!defined('TWITTER_CLIENT_SECRET')) define('TWITTER_CLIENT_SECRET', getenv('TWITTER_CLIENT_SECRET') ?: '');
define('TWITTER_REDIRECT_URI', BASE_URL . '/oauth_callback.php?provider=twitter');

// OAuth enabled check
function isOAuthEnabled(string $provider): bool
{
    switch ($provider) {
        case 'google':
            return !empty(GOOGLE_CLIENT_ID) && !empty(GOOGLE_CLIENT_SECRET);
        case 'twitter':
            return !empty(TWITTER_CLIENT_ID) && !empty(TWITTER_CLIENT_SECRET);
        default:
            return false;
    }
}
