<?php

/**
 * ApiGate — API Key Authentication & Rate Limiting by Tier
 *
 * Tiers:
 *   free       — 100 req/day (default, no key required for public endpoints)
 *   researcher — 1,000 req/day
 *   enterprise — unlimited
 *   government — unlimited + custom
 *
 * Usage:
 *   require_once __DIR__ . '/ApiGate.php';
 *   ApiGate::check('researcher'); // Requires at least 'researcher' tier
 */
class ApiGate
{
    // Tier hierarchy (higher number = higher access)
    private const TIERS = [
        'free'       => 0,
        'researcher' => 1,
        'enterprise' => 2,
        'government' => 3,
    ];

    // Daily rate limits per tier
    private const RATE_LIMITS = [
        'free'       => 100,
        'researcher' => 1000,
        'enterprise' => 0,  // 0 = unlimited
        'government' => 0,
    ];

    /**
     * Validate API key and enforce minimum tier.
     * Returns the authenticated tier info or halts with 401/403/429.
     *
     * @param string $minTier Minimum tier required ('free', 'researcher', 'enterprise', 'government')
     * @return array ['tier' => string, 'org' => string, 'key_id' => string]
     */
    public static function check(string $minTier = 'free'): array
    {
        $apiKey = self::extractKey();

        // No key provided — treat as free tier
        if (!$apiKey) {
            if ($minTier !== 'free') {
                self::deny(401, 'API key required. Get one at https://ikimon.life/developer');
            }
            // Free tier: rate limit by IP
            self::rateLimitByIP();
            return ['tier' => 'free', 'org' => '', 'key_id' => ''];
        }

        // Look up the key
        $keyData = self::findKey($apiKey);
        if (!$keyData) {
            self::deny(401, 'Invalid API key.');
        }

        if (($keyData['status'] ?? '') !== 'active') {
            self::deny(403, 'API key is suspended. Contact support@ikimon.life');
        }

        $tier = $keyData['tier'] ?? 'free';

        // Check tier authorization
        $requiredLevel = self::TIERS[$minTier] ?? 0;
        $actualLevel = self::TIERS[$tier] ?? 0;
        if ($actualLevel < $requiredLevel) {
            self::deny(403, "This endpoint requires '{$minTier}' tier or above. Your tier: '{$tier}'. Upgrade at https://ikimon.life/pricing");
        }

        // Rate limit by key
        self::rateLimitByKey($keyData);

        // Track usage
        self::trackUsage($keyData['id']);

        return [
            'tier'   => $tier,
            'org'    => $keyData['organization'] ?? '',
            'key_id' => $keyData['id'] ?? '',
        ];
    }

    /**
     * Extract API key from request headers or query parameters
     */
    private static function extractKey(): ?string
    {
        // Header: Authorization: Bearer <key>
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
            return trim($m[1]);
        }

        // Header: X-Api-Key: <key>
        $xApiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
        if (!empty($xApiKey)) {
            return trim($xApiKey);
        }

        // Query param: ?api_key=<key>
        return !empty($_GET['api_key']) ? trim($_GET['api_key']) : null;
    }

    /**
     * Look up an API key in the DataStore
     */
    private static function findKey(string $key): ?array
    {
        require_once __DIR__ . '/DataStore.php';
        $keys = DataStore::fetchAll('api_keys');
        foreach ($keys as $k) {
            // Constant-time comparison to prevent timing attacks
            if (hash_equals($k['key_hash'] ?? '', hash('sha256', $key))) {
                return $k;
            }
        }
        return null;
    }

    /**
     * Rate limit by IP for free/unauthenticated requests
     */
    private static function rateLimitByIP(): void
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $limit = self::RATE_LIMITS['free'];
        $cacheFile = sys_get_temp_dir() . '/ikimon_ratelimit_' . md5($ip) . '.json';
        self::enforceLimit($cacheFile, $limit);
    }

    /**
     * Rate limit by API key
     */
    private static function rateLimitByKey(array $keyData): void
    {
        $tier = $keyData['tier'] ?? 'free';
        $limit = self::RATE_LIMITS[$tier] ?? 100;
        if ($limit === 0) return; // Unlimited

        $cacheFile = sys_get_temp_dir() . '/ikimon_ratelimit_key_' . md5($keyData['id']) . '.json';
        self::enforceLimit($cacheFile, $limit);
    }

    /**
     * Enforce rate limit using a temporary file counter
     */
    private static function enforceLimit(string $cacheFile, int $limit): void
    {
        $today = date('Y-m-d');
        $data = ['date' => '', 'count' => 0];

        if (file_exists($cacheFile)) {
            $raw = @file_get_contents($cacheFile);
            $data = json_decode($raw, true) ?: $data;
        }

        // Reset counter on new day
        if (($data['date'] ?? '') !== $today) {
            $data = ['date' => $today, 'count' => 0];
        }

        $data['count']++;

        if ($data['count'] > $limit) {
            header('Retry-After: ' . (strtotime('tomorrow') - time()));
            self::deny(429, "Rate limit exceeded ({$limit}/day). Upgrade your plan at https://ikimon.life/pricing");
        }

        @file_put_contents($cacheFile, json_encode($data), LOCK_EX);
    }

    /**
     * Track API usage for analytics / billing
     */
    private static function trackUsage(string $keyId): void
    {
        // Lightweight: just update last_used and increment counter
        // Full analytics can be done async later
        require_once __DIR__ . '/DataStore.php';
        $keys = DataStore::fetchAll('api_keys');
        foreach ($keys as &$k) {
            if (($k['id'] ?? '') === $keyId) {
                $k['last_used'] = date('Y-m-d H:i:s');
                $k['usage_count'] = ($k['usage_count'] ?? 0) + 1;
                DataStore::upsert('api_keys', $k);
                break;
            }
        }
    }

    /**
     * Deny access with appropriate HTTP status and JSON error
     */
    private static function deny(int $status, string $message): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'error' => true,
            'status' => $status,
            'message' => $message,
            'docs' => 'https://ikimon.life/developer/docs',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
