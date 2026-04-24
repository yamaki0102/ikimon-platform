<?php

require_once __DIR__ . '/Auth.php';

/**
 * FB-12: API Rate Limiter
 * Protects against DoS attacks and API abuse
 * 
 * Usage:
 *   require_once __DIR__ . '/RateLimiter.php';
 *   RateLimiter::check(); // Will exit with 429 if rate exceeded
 */

class RateLimiter
{
    // Rate limits (requests per minute)
    const LIMIT_ANONYMOUS = 60;    // Unauthenticated users
    const LIMIT_AUTHENTICATED = 300; // Logged in users
    const LIMIT_ADMIN = 1000;      // Admin users

    // Time window in seconds
    const WINDOW = 60;

    // Storage directory for rate limit data
    private static $storageDir = null;

    /**
     * Initialize storage directory
     */
    private static function init()
    {
        if (self::$storageDir === null) {
            self::$storageDir = (defined('DATA_DIR') ? DATA_DIR : __DIR__ . '/../data') . '/rate_limits';
            if (!is_dir(self::$storageDir)) {
                mkdir(self::$storageDir, 0700, true);
            }
        }
    }

    /**
     * Get client identifier (IP + optional user ID)
     */
    private static function getClientId()
    {
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        // Clean up IP if multiple (proxy)
        if (strpos($ip, ',') !== false) {
            $ip = trim(explode(',', $ip)[0]);
        }

        // Add user ID if authenticated (use Auth::init for correct session path)
        Auth::init();
        $userId = $_SESSION['user']['id'] ?? null;

        if ($userId) {
            return 'user_' . md5($userId);
        }
        return 'ip_' . md5($ip);
    }

    /**
     * Get the appropriate rate limit for current user
     */
    private static function getLimit()
    {
        Auth::init();

        $user = $_SESSION['user'] ?? null;
        if (!$user) {
            return self::LIMIT_ANONYMOUS;
        }

        $rank = $user['rank'] ?? 'Observer';
        if (in_array($rank, ['Admin', 'Analyst'])) {
            return self::LIMIT_ADMIN;
        }

        return self::LIMIT_AUTHENTICATED;
    }

    /**
     * Get rate limit file path for a client
     */
    private static function getFilePath($clientId)
    {
        self::init();
        return self::$storageDir . '/' . $clientId . '.json';
    }

    /**
     * Check rate limit and exit with 429 if exceeded
     * 
     * @param bool $exitOnExceed If true, will exit with 429 response
     * @return bool True if within limit, false if exceeded
     */
    public static function check($exitOnExceed = true)
    {
        $clientId = self::getClientId();
        $limit = self::getLimit();
        $now = time();
        $windowStart = $now - self::WINDOW;

        $filePath = self::getFilePath($clientId);

        // Read existing data
        $data = ['requests' => []];
        if (file_exists($filePath)) {
            $content = file_get_contents($filePath);
            $data = json_decode($content, true) ?: ['requests' => []];
        }

        // Filter out old requests (outside window)
        $data['requests'] = array_filter($data['requests'], function ($timestamp) use ($windowStart) {
            return $timestamp > $windowStart;
        });

        // Check if exceeded
        $requestCount = count($data['requests']);
        $remaining = $limit - $requestCount;

        // Set rate limit headers
        header('X-RateLimit-Limit: ' . $limit);
        header('X-RateLimit-Remaining: ' . max(0, $remaining - 1));
        header('X-RateLimit-Reset: ' . ($now + self::WINDOW));

        if ($requestCount >= $limit) {
            if ($exitOnExceed) {
                header('HTTP/1.1 429 Too Many Requests');
                header('Content-Type: application/json');
                header('Retry-After: ' . self::WINDOW);
                echo json_encode([
                    'success' => false,
                    'error' => 'Rate limit exceeded',
                    'message' => 'リクエスト数の上限に達しました。しばらく待ってから再度お試しください。',
                    'retry_after' => self::WINDOW
                ]);
                exit;
            }
            return false;
        }

        // Record this request
        $data['requests'][] = $now;

        // Save data
        file_put_contents($filePath, json_encode($data), LOCK_EX);

        return true;
    }

    /**
     * Stricter rate limit specifically for observation posts.
     * Max 10 posts per 5 minutes per IP/user.
     * 
     * @return bool True if within limit
     */
    public static function checkPost(): bool
    {
        $clientId = self::getClientId() . '_post';
        $limit = 10;
        $window = 300; // 5 minutes
        $now = time();
        $windowStart = $now - $window;

        $filePath = self::getFilePath($clientId);

        $data = ['requests' => []];
        if (file_exists($filePath)) {
            $content = file_get_contents($filePath);
            $data = json_decode($content, true) ?: ['requests' => []];
        }

        $data['requests'] = array_values(array_filter($data['requests'], function ($ts) use ($windowStart) {
            return $ts > $windowStart;
        }));

        if (count($data['requests']) >= $limit) {
            header('HTTP/1.1 429 Too Many Requests');
            header('Content-Type: application/json');
            header('Retry-After: ' . $window);
            echo json_encode([
                'success' => false,
                'error' => 'Post rate limit exceeded',
                'message' => '短時間に多くの投稿が検出されました。5分後に再度お試しください。',
                'retry_after' => $window
            ]);
            exit;
        }

        $data['requests'][] = $now;
        file_put_contents($filePath, json_encode($data), LOCK_EX);

        return true;
    }

    /**
     * Clean up old rate limit files (run periodically)
     */
    public static function cleanup()
    {
        self::init();
        $cutoff = time() - (self::WINDOW * 2);

        $files = glob(self::$storageDir . '/*.json');
        foreach ($files as $file) {
            if (filemtime($file) < $cutoff) {
                unlink($file);
            }
        }
    }

    /**
     * Get current status for a client (for debugging/monitoring)
     */
    public static function getStatus()
    {
        $clientId = self::getClientId();
        $limit = self::getLimit();
        $filePath = self::getFilePath($clientId);

        $data = ['requests' => []];
        if (file_exists($filePath)) {
            $content = file_get_contents($filePath);
            $data = json_decode($content, true) ?: ['requests' => []];
        }

        $windowStart = time() - self::WINDOW;
        $recentRequests = array_filter($data['requests'], function ($ts) use ($windowStart) {
            return $ts > $windowStart;
        });

        return [
            'client_id' => $clientId,
            'limit' => $limit,
            'used' => count($recentRequests),
            'remaining' => max(0, $limit - count($recentRequests)),
            'window_seconds' => self::WINDOW
        ];
    }
}
