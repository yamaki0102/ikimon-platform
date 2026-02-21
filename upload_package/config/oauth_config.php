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
define('GOOGLE_CLIENT_ID', getenv('GOOGLE_CLIENT_ID') ?: '834176106048-ip4qjbshpfqo48u8df2vh5hedln08vhq.apps.googleusercontent.com');
define('GOOGLE_CLIENT_SECRET', getenv('GOOGLE_CLIENT_SECRET') ?: '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');
define('GOOGLE_REDIRECT_URI', BASE_URL . '/oauth_callback.php?provider=google');

// X (Twitter) OAuth 2.0
define('TWITTER_CLIENT_ID', getenv('TWITTER_CLIENT_ID') ?: 'aGJfNllZRmctYW8yMUtaVzdpQnU6MTpjaQ');
define('TWITTER_CLIENT_SECRET', getenv('TWITTER_CLIENT_SECRET') ?: 'HVhfT6otv5hrQ5lbnP1vT5CM0Ro-7CV8HMlHUbDrMpX1uh3BCT');
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
