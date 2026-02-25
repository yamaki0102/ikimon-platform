<?php

/**
 * Auth - Secure authentication handler
 * FB-13: Enhanced with secure session settings
 * FB-14: Persistent login via Remember Me tokens (YouTube-style)
 */

class Auth
{
    // Session timeout in seconds (7 days inactivity)
    const SESSION_TIMEOUT = 604800;
    // Cookie lifetime (90 days — YouTube-style persistent login)
    const COOKIE_LIFETIME = 7776000;
    // Remember Me token lifetime (90 days)
    const REMEMBER_ME_LIFETIME = 7776000;
    // Maximum posts allowed for guest users
    const GUEST_POST_LIMIT = 3;
    // Remember Me cookie name
    const REMEMBER_COOKIE = 'ikimon_remember';

    /**
     * Initialize session with secure settings
     */
    public static function init()
    {
        if (session_status() === PHP_SESSION_NONE) {
            // Override shared hosting's short gc_maxlifetime (often 24min)
            ini_set('session.gc_maxlifetime', self::SESSION_TIMEOUT);

            // FB-13: Secure session cookie settings
            $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
                || ($_SERVER['SERVER_PORT'] ?? 80) == 443;

            session_set_cookie_params([
                'lifetime' => self::COOKIE_LIFETIME,
                'path' => '/',
                'domain' => '',
                'secure' => $isHttps,
                'httponly' => true,
                'samesite' => 'Lax'
            ]);

            // Use custom session save path to avoid shared hosting GC conflicts
            $customSessionDir = (defined('DATA_DIR') ? DATA_DIR : dirname(__DIR__) . '/data') . '/sessions';
            if (!is_dir($customSessionDir)) {
                @mkdir($customSessionDir, 0700, true);
            }
            if (is_dir($customSessionDir) && is_writable($customSessionDir)) {
                session_save_path($customSessionDir);
            }

            session_start();

            // Check session timeout
            self::checkTimeout();

            // FB-14: Auto-restore from Remember Me token if session is empty
            if (!isset($_SESSION['user'])) {
                self::restoreFromRememberToken();
            }

            // Ensure CSRF cookie exists for all pages
            if (empty($_COOKIE['ikimon_csrf'])) {
                require_once __DIR__ . '/CSRF.php';
                CSRF::generate();
            }
        }
    }

    /**
     * Check if session has timed out
     */
    private static function checkTimeout()
    {
        if (isset($_SESSION['last_activity'])) {
            $inactive = time() - $_SESSION['last_activity'];
            if ($inactive > self::SESSION_TIMEOUT) {
                // Session expired, destroy it (but keep remember me cookie)
                $_SESSION = [];
                session_regenerate_id(true);
                return;
            }
        }
        // Update last activity time
        $_SESSION['last_activity'] = time();
    }

    public static function user()
    {
        self::init();
        return $_SESSION['user'] ?? null;
    }

    public static function isLoggedIn()
    {
        self::init();
        return isset($_SESSION['user']);
    }

    /**
     * Initialize a guest session (for anonymous posting)
     */
    public static function initGuest()
    {
        self::init();
        if (!isset($_SESSION['guest_id'])) {
            $_SESSION['guest_id'] = 'guest_' . bin2hex(random_bytes(8));
            $_SESSION['guest_post_count'] = 0;
            $_SESSION['guest_post_ids'] = [];
        }
    }

    public static function isGuest()
    {
        self::init();
        return !self::isLoggedIn() && isset($_SESSION['guest_id']);
    }

    public static function getGuestId()
    {
        self::initGuest();
        return $_SESSION['guest_id'];
    }

    public static function getGuestPostCount()
    {
        self::init();
        return $_SESSION['guest_post_count'] ?? 0;
    }

    public static function incrementGuestPostCount($observationId)
    {
        self::init();
        $_SESSION['guest_post_count'] = ($_SESSION['guest_post_count'] ?? 0) + 1;
        $_SESSION['guest_post_ids'][] = $observationId;
    }

    public static function canGuestPost()
    {
        return self::getGuestPostCount() < self::GUEST_POST_LIMIT;
    }

    public static function getGuestPostIds()
    {
        self::init();
        return $_SESSION['guest_post_ids'] ?? [];
    }

    /**
     * Migrate guest data to authenticated user
     */
    public static function migrateGuestData()
    {
        self::init();
        $guestId = $_SESSION['guest_id'] ?? null;
        $postIds = $_SESSION['guest_post_ids'] ?? [];

        unset($_SESSION['guest_id']);
        unset($_SESSION['guest_post_count']);
        unset($_SESSION['guest_post_ids']);

        return [
            'guest_id' => $guestId,
            'post_ids' => $postIds
        ];
    }

    /**
     * Login user with session regeneration for security
     * FB-14: Also issues a Remember Me token for persistent login
     */
    public static function login($user)
    {
        self::init();

        // FB-13: Regenerate session ID on login to prevent session fixation
        session_regenerate_id(true);

        $_SESSION['user'] = $user;
        $_SESSION['last_activity'] = time();
        $_SESSION['login_time'] = time();
        $_SESSION['user_agent'] = $_SERVER['HTTP_USER_AGENT'] ?? '';

        // FB-14: Issue Remember Me token for persistent login
        self::issueRememberToken($user);
    }

    /**
     * Logout and clean up all persistent tokens
     */
    public static function logout()
    {
        self::init();

        // FB-14: Remove Remember Me token
        self::clearRememberToken();

        // Clear all session data
        $_SESSION = [];

        // Delete session cookie
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params["path"],
                $params["domain"],
                $params["secure"],
                $params["httponly"]
            );
        }

        session_destroy();
    }

    // ========================================
    // FB-14: Remember Me Token System
    // ========================================

    /**
     * Issue a Remember Me token and store it as a cookie + server-side hash
     */
    private static function issueRememberToken($user)
    {
        $userId = $user['id'] ?? '';
        if (empty($userId)) return;

        // Generate secure random token
        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);
        $expires = time() + self::REMEMBER_ME_LIFETIME;

        // Store token hash server-side
        $tokensFile = self::getTokensFilePath();
        $tokens = self::loadTokens($tokensFile);

        // Remove any existing tokens for this user (1 token per user)
        $tokens = array_filter($tokens, function ($t) use ($userId) {
            return ($t['user_id'] ?? '') !== $userId;
        });

        // Add new token
        $tokens[] = [
            'user_id' => $userId,
            'token_hash' => $tokenHash,
            'user_data' => $user,
            'expires' => $expires,
            'created_at' => date('Y-m-d H:i:s'),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
        ];

        // Purge expired tokens while we're at it
        $now = time();
        $tokens = array_values(array_filter($tokens, function ($t) use ($now) {
            return ($t['expires'] ?? 0) > $now;
        }));

        self::saveTokens($tokensFile, $tokens);

        // Set cookie with the raw token (not the hash)
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || ($_SERVER['SERVER_PORT'] ?? 80) == 443;

        setcookie(self::REMEMBER_COOKIE, $token, [
            'expires' => $expires,
            'path' => '/',
            'domain' => '',
            'secure' => $isHttps,
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
    }

    /**
     * Restore login from Remember Me cookie when session has expired
     */
    private static function restoreFromRememberToken()
    {
        $token = $_COOKIE[self::REMEMBER_COOKIE] ?? '';
        if (empty($token)) return;

        $tokenHash = hash('sha256', $token);
        $tokensFile = self::getTokensFilePath();
        $tokens = self::loadTokens($tokensFile);

        $now = time();
        foreach ($tokens as $stored) {
            if (($stored['token_hash'] ?? '') === $tokenHash && ($stored['expires'] ?? 0) > $now) {
                // Valid token found — verify user is still active
                $user = $stored['user_data'] ?? null;
                if ($user) {
                    // SEC: Re-validate against current user data to catch BAN/role changes
                    $freshUser = self::getFreshUserData($user['id'] ?? '');
                    if ($freshUser && empty($freshUser['banned'])) {
                        session_regenerate_id(true);
                        $_SESSION['user'] = $freshUser; // Use fresh data, not stale token copy
                        $_SESSION['last_activity'] = time();
                        $_SESSION['login_time'] = time();
                        $_SESSION['user_agent'] = $_SERVER['HTTP_USER_AGENT'] ?? '';
                        $_SESSION['restored_from_token'] = true;

                        // Rotate token for security (invalidate old, issue new)
                        self::issueRememberToken($freshUser);
                        return;
                    }
                    // User banned or deleted — revoke token
                    self::clearRememberToken();
                    return;
                }
            }
        }

        // Invalid or expired token — clean up cookie
        self::clearRememberCookie();
    }

    /**
     * Clear Remember Me token from server and cookie
     */
    private static function clearRememberToken()
    {
        $token = $_COOKIE[self::REMEMBER_COOKIE] ?? '';
        if (!empty($token)) {
            $tokenHash = hash('sha256', $token);
            $tokensFile = self::getTokensFilePath();
            $tokens = self::loadTokens($tokensFile);

            // Remove matching token
            $tokens = array_values(array_filter($tokens, function ($t) use ($tokenHash) {
                return ($t['token_hash'] ?? '') !== $tokenHash;
            }));

            self::saveTokens($tokensFile, $tokens);
        }

        self::clearRememberCookie();
    }

    /**
     * Delete the remember me cookie
     */
    private static function clearRememberCookie()
    {
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || ($_SERVER['SERVER_PORT'] ?? 80) == 443;

        setcookie(self::REMEMBER_COOKIE, '', [
            'expires' => time() - 42000,
            'path' => '/',
            'domain' => '',
            'secure' => $isHttps,
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
    }

    /**
     * Get the path to the tokens storage file
     */
    private static function getTokensFilePath()
    {
        $dataDir = defined('DATA_DIR') ? DATA_DIR : dirname(__DIR__) . '/data';
        return $dataDir . '/auth_tokens.json';
    }

    /**
     * Load tokens from file
     */
    private static function loadTokens($filePath)
    {
        if (!file_exists($filePath)) return [];
        $fp = @fopen($filePath, 'r');
        if ($fp === false) return [];
        flock($fp, LOCK_SH);
        $data = stream_get_contents($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        if ($data === false || $data === '') return [];
        $tokens = json_decode($data, true);
        return is_array($tokens) ? $tokens : [];
    }

    /**
     * Save tokens to file
     */
    private static function saveTokens($filePath, $tokens)
    {
        $dir = dirname($filePath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        @file_put_contents($filePath, json_encode($tokens, JSON_PRETTY_PRINT), LOCK_EX);
    }

    // ========================================
    // Session Validation & Roles
    // ========================================

    /**
     * Fetch latest user data from UserStore (for token restoration)
     * SEC: Prevents restored sessions from using stale BAN/role data
     */
    private static function getFreshUserData(string $userId): ?array
    {
        if (empty($userId)) return null;
        require_once __DIR__ . '/UserStore.php';
        return UserStore::findById($userId);
    }


    /**
     * Validate session integrity (check for session hijacking)
     */
    public static function validateSession()
    {
        self::init();

        if (!isset($_SESSION['user'])) {
            return true;
        }

        // Check if user agent changed significantly (potential session hijacking)
        // Only compare browser family to avoid false positives from
        // minor UA changes (browser updates, PWA mode switches, etc.)
        $currentUA = $_SERVER['HTTP_USER_AGENT'] ?? '';
        $sessionUA = $_SESSION['user_agent'] ?? '';

        if ($sessionUA && $currentUA) {
            $currentFamily = self::extractBrowserFamily($currentUA);
            $sessionFamily = self::extractBrowserFamily($sessionUA);

            if ($currentFamily && $sessionFamily && $currentFamily !== $sessionFamily) {
                self::logout();
                return false;
            }
        }

        // Update stored UA to current (handles minor version changes)
        $_SESSION['user_agent'] = $currentUA;

        return true;
    }

    public static function hasRole($role)
    {
        $u = self::user();
        if (!$u) return false;
        $ranks = ['Observer' => 1, 'Specialist' => 2, 'Analyst' => 3, 'Admin' => 4];
        $userRole = self::getRole($u);
        $userRank = $ranks[$userRole] ?? 1;
        $requiredRank = $ranks[$role] ?? 1;
        return $userRank >= $requiredRank;
    }

    public static function requireRole($role)
    {
        if (!self::hasRole($role)) {
            header("HTTP/1.1 403 Forbidden");
            echo "Access Denied. You need to be a " . htmlspecialchars($role) . ".";
            exit;
        }
    }

    /**
     * Check if user is on Premium Plan
     * - Admins are always treated as Premium
     * - Checks 'plan' field in user data
     */
    public static function isPremium()
    {
        $user = self::user();
        if (!$user) return false;

        // Admin is always Premium
        if (self::hasRole('Admin')) return true;

        // Check user plan
        return ($user['plan'] ?? 'free') === 'premium';
    }

    /**
     * Get session info for debugging/monitoring
     */
    public static function getSessionInfo()
    {
        self::init();
        return [
            'logged_in' => self::isLoggedIn(),
            'user_id' => $_SESSION['user']['id'] ?? null,
            'login_time' => isset($_SESSION['login_time'])
                ? date('Y-m-d H:i:s', $_SESSION['login_time'])
                : null,
            'last_activity' => isset($_SESSION['last_activity'])
                ? date('Y-m-d H:i:s', $_SESSION['last_activity'])
                : null,
            'timeout_in' => isset($_SESSION['last_activity'])
                ? max(0, self::SESSION_TIMEOUT - (time() - $_SESSION['last_activity']))
                : null,
            'has_remember_token' => !empty($_COOKIE[self::REMEMBER_COOKIE]),
            'restored_from_token' => $_SESSION['restored_from_token'] ?? false,
        ];
    }

    public static function getRole($user)
    {
        $role = $user['role'] ?? null;
        if ($role) return $role;

        $rank = $user['rank'] ?? 'Observer';
        $rankMap = [
            'ビギナー' => 'Observer',
            '観察者' => 'Observer',
            '熟練者' => 'Specialist',
            '認定研究者' => 'Analyst',
            '博士' => 'Analyst',
            '管理者' => 'Admin',
            'Observer' => 'Observer',
            'Specialist' => 'Specialist',
            'Analyst' => 'Analyst',
            'Admin' => 'Admin'
        ];
        return $rankMap[$rank] ?? 'Observer';
    }

    public static function getRankLabel($user)
    {
        $rank = $user['rank'] ?? null;
        if ($rank) return $rank;
        $role = $user['role'] ?? 'Observer';
        $labelMap = [
            'Observer' => '観察者',
            'Specialist' => '熟練者',
            'Analyst' => '認定研究者',
            'Admin' => '管理者'
        ];
        return $labelMap[$role] ?? '観察者';
    }

    /**
     * Extract browser family from User-Agent string
     */
    private static function extractBrowserFamily($ua)
    {
        if (preg_match('/Edg[e\/]/i', $ua)) return 'Edge';
        if (preg_match('/OPR\//i', $ua)) return 'Opera';
        if (preg_match('/Firefox\//i', $ua)) return 'Firefox';
        if (preg_match('/Chrome\//i', $ua)) return 'Chrome';
        if (preg_match('/Safari\//i', $ua)) return 'Safari';
        if (preg_match('/MSIE|Trident/i', $ua)) return 'IE';
        return null;
    }
}
