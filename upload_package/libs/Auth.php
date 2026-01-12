<?php
/**
 * Auth - Secure authentication handler
 * FB-13: Enhanced with secure session settings
 */

class Auth {
    // Session timeout in seconds (2 hours)
    const SESSION_TIMEOUT = 7200;
    
    /**
     * Initialize session with secure settings
     */
    public static function init() {
        if (session_status() === PHP_SESSION_NONE) {
            // FB-13: Secure session cookie settings
            $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') 
                       || ($_SERVER['SERVER_PORT'] ?? 80) == 443;
            
            session_set_cookie_params([
                'lifetime' => self::SESSION_TIMEOUT,
                'path' => '/',
                'domain' => '',
                'secure' => $isHttps,      // Only send cookie over HTTPS
                'httponly' => true,         // Prevent JavaScript access
                'samesite' => 'Lax'         // CSRF protection (Lax allows normal navigation)
            ]);
            
            session_start();
            
            // Check session timeout
            self::checkTimeout();
        }
    }
    
    /**
     * Check if session has timed out
     */
    private static function checkTimeout() {
        if (isset($_SESSION['last_activity'])) {
            $inactive = time() - $_SESSION['last_activity'];
            if ($inactive > self::SESSION_TIMEOUT) {
                // Session expired, destroy it
                self::logout();
                return;
            }
        }
        // Update last activity time
        $_SESSION['last_activity'] = time();
    }

    public static function user() {
        self::init();
        return $_SESSION['user'] ?? null;
    }
    
    public static function isLoggedIn() {
        self::init();
        return isset($_SESSION['user']);
    }

    /**
     * Login user with session regeneration for security
     */
    public static function login($user) {
        self::init();
        
        // FB-13: Regenerate session ID on login to prevent session fixation
        session_regenerate_id(true);
        
        $_SESSION['user'] = $user;
        $_SESSION['last_activity'] = time();
        $_SESSION['login_time'] = time();
        $_SESSION['user_agent'] = $_SERVER['HTTP_USER_AGENT'] ?? '';
    }

    public static function logout() {
        self::init();
        
        // Clear all session data
        $_SESSION = [];
        
        // Delete session cookie
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        
        session_destroy();
    }
    
    /**
     * Validate session integrity (check for session hijacking)
     */
    public static function validateSession() {
        self::init();
        
        if (!isset($_SESSION['user'])) {
            return true; // No user session to validate
        }
        
        // Check if user agent changed (potential session hijacking)
        $currentUA = $_SERVER['HTTP_USER_AGENT'] ?? '';
        $sessionUA = $_SESSION['user_agent'] ?? '';
        
        if ($sessionUA && $currentUA !== $sessionUA) {
            // User agent mismatch - possible hijacking attempt
            self::logout();
            return false;
        }
        
        return true;
    }
    
    public static function hasRole($role) {
        $u = self::user();
        if (!$u) return false;
        // Simple hierarchy: Admin > Analyst > Specialist > Observer
        $ranks = ['Observer' => 1, 'Specialist' => 2, 'Analyst' => 3, 'Admin' => 4];
        $userRole = self::getRole($u);
        $userRank = $ranks[$userRole] ?? 1;
        $requiredRank = $ranks[$role] ?? 1;
        return $userRank >= $requiredRank;
    }

    public static function requireRole($role) {
        if (!self::hasRole($role)) {
            // Redirect to a clean 403 or login
            header("HTTP/1.1 403 Forbidden");
            echo "Access Denied. You need to be a " . htmlspecialchars($role) . ".";
            exit;
        }
    }
    
    /**
     * Get session info for debugging/monitoring
     */
    public static function getSessionInfo() {
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
                : null
        ];
    }

    public static function getRole($user) {
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

    public static function getRankLabel($user) {
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
}

