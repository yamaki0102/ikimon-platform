<?php

/**
 * OAuthClient - Lightweight OAuth 2.0 client for Google & X (Twitter)
 * 
 * No external dependencies (no Composer).
 * Uses PHP's built-in curl for HTTP requests.
 * 
 * Google: Authorization Code Flow
 * X (Twitter): OAuth 2.0 with PKCE
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/oauth_config.php';
require_once __DIR__ . '/Auth.php';

class OAuthClient
{

    /**
     * Generate authorization URL for the given provider
     */
    public static function getAuthUrl(string $provider): string
    {
        Auth::init();

        $state = bin2hex(random_bytes(16));
        $_SESSION['oauth_state'] = $state;
        $_SESSION['oauth_provider'] = $provider;

        switch ($provider) {
            case 'google':
                return self::googleAuthUrl($state);
            case 'twitter':
                return self::twitterAuthUrl($state);
            default:
                throw new \InvalidArgumentException("Unknown provider: {$provider}");
        }
    }

    /**
     * Handle the callback from the OAuth provider.
     * Returns user profile array: ['id', 'name', 'email', 'avatar_url', 'provider']
     */
    public static function handleCallback(string $provider, array $params): array
    {
        // Validate state
        $expectedState = $_SESSION['oauth_state'] ?? '';
        $receivedState = $params['state'] ?? '';

        if (!$expectedState || !hash_equals($expectedState, $receivedState)) {
            throw new \RuntimeException('Invalid OAuth state. Possible CSRF attack.');
        }

        // Clean up state
        unset($_SESSION['oauth_state'], $_SESSION['oauth_provider']);

        $code = $params['code'] ?? '';
        if (empty($code)) {
            $error = $params['error'] ?? 'unknown';
            throw new \RuntimeException("OAuth authorization failed: {$error}");
        }

        switch ($provider) {
            case 'google':
                return self::googleCallback($code);
            case 'twitter':
                return self::twitterCallback($code);
            default:
                throw new \InvalidArgumentException("Unknown provider: {$provider}");
        }
    }

    // ========================================
    // Google OAuth 2.0
    // ========================================

    private static function googleAuthUrl(string $state): string
    {
        $params = [
            'client_id'     => GOOGLE_CLIENT_ID,
            'redirect_uri'  => GOOGLE_REDIRECT_URI,
            'response_type' => 'code',
            'scope'         => 'openid email profile',
            'state'         => $state,
            'access_type'   => 'offline',
            'prompt'        => 'select_account',
        ];
        return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params);
    }

    private static function googleCallback(string $code): array
    {
        // Exchange code for tokens
        $tokenData = self::httpPost('https://oauth2.googleapis.com/token', [
            'code'          => $code,
            'client_id'     => GOOGLE_CLIENT_ID,
            'client_secret' => GOOGLE_CLIENT_SECRET,
            'redirect_uri'  => GOOGLE_REDIRECT_URI,
            'grant_type'    => 'authorization_code',
        ]);

        if (empty($tokenData['access_token'])) {
            throw new \RuntimeException('Failed to obtain Google access token');
        }

        // Get user info
        $userInfo = self::httpGet(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            $tokenData['access_token']
        );

        return [
            'id'         => $userInfo['id'] ?? '',
            'name'       => $userInfo['name'] ?? '',
            'email'      => $userInfo['email'] ?? '',
            'avatar_url' => $userInfo['picture'] ?? '',
            'provider'   => 'google',
        ];
    }

    // ========================================
    // X (Twitter) OAuth 2.0 with PKCE
    // ========================================

    private static function twitterAuthUrl(string $state): string
    {
        // PKCE: Generate code verifier and challenge
        $codeVerifier = self::generateCodeVerifier();
        $_SESSION['oauth_code_verifier'] = $codeVerifier;
        $codeChallenge = self::generateCodeChallenge($codeVerifier);

        $params = [
            'response_type'         => 'code',
            'client_id'             => TWITTER_CLIENT_ID,
            'redirect_uri'          => TWITTER_REDIRECT_URI,
            'scope'                 => 'tweet.read users.read offline.access',
            'state'                 => $state,
            'code_challenge'        => $codeChallenge,
            'code_challenge_method' => 'S256',
        ];
        return 'https://twitter.com/i/oauth2/authorize?' . http_build_query($params);
    }

    private static function twitterCallback(string $code): array
    {
        $codeVerifier = $_SESSION['oauth_code_verifier'] ?? '';
        unset($_SESSION['oauth_code_verifier']);

        if (empty($codeVerifier)) {
            throw new \RuntimeException('Missing PKCE code verifier');
        }

        // Exchange code for tokens (Basic Auth required)
        $tokenData = self::httpPost(
            'https://api.x.com/2/oauth2/token',
            [
                'code'          => $code,
                'grant_type'    => 'authorization_code',
                'redirect_uri'  => TWITTER_REDIRECT_URI,
                'code_verifier' => $codeVerifier,
            ],
            [
                'Authorization: Basic ' . base64_encode(TWITTER_CLIENT_ID . ':' . TWITTER_CLIENT_SECRET),
                'Content-Type: application/x-www-form-urlencoded',
            ]
        );

        if (empty($tokenData['access_token'])) {
            throw new \RuntimeException('Failed to obtain X access token');
        }

        // Get user info
        $userInfo = self::httpGet(
            'https://api.x.com/2/users/me?user.fields=profile_image_url,name',
            $tokenData['access_token']
        );

        $data = $userInfo['data'] ?? [];

        return [
            'id'         => $data['id'] ?? '',
            'name'       => $data['name'] ?? $data['username'] ?? '',
            'email'      => '', // X does not provide email in basic scope
            'avatar_url' => $data['profile_image_url'] ?? '',
            'provider'   => 'twitter',
        ];
    }

    // ========================================
    // PKCE helpers
    // ========================================

    private static function generateCodeVerifier(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    private static function generateCodeChallenge(string $verifier): string
    {
        return rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
    }

    // ========================================
    // HTTP helpers (no external dependencies)
    // ========================================

    private static function httpPost(string $url, array $data, array $headers = []): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query($data),
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        if (!empty($headers)) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new \RuntimeException("HTTP request failed: {$error}");
        }

        $decoded = json_decode($response, true);
        if ($httpCode >= 400) {
            $msg = $decoded['error_description'] ?? $decoded['error'] ?? "HTTP {$httpCode}";
            throw new \RuntimeException("OAuth API error: {$msg}");
        }

        return $decoded ?: [];
    }

    private static function httpGet(string $url, string $accessToken): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => [
                "Authorization: Bearer {$accessToken}",
                'Accept: application/json',
            ],
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new \RuntimeException("HTTP request failed: {$error}");
        }

        $decoded = json_decode($response, true);
        if ($httpCode >= 400) {
            $msg = $decoded['error'] ?? "HTTP {$httpCode}";
            throw new \RuntimeException("OAuth API error: {$msg}");
        }

        return $decoded ?: [];
    }
}
