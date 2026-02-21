<?php

/**
 * CSRF - Cross-Site Request Forgery protection
 * 
 * Uses Double-Submit Cookie pattern:
 * - Token is stored in BOTH a cookie AND embedded in the form
 * - On submit, cookie token is compared to form token
 * - No session dependency = immune to session GC on shared hosting
 * 
 * Security: An attacker can't read or set cookies for our domain,
 * so they can't forge a matching cookie+form pair.
 */

class CSRF
{
    const COOKIE_NAME = 'ikimon_csrf';
    const COOKIE_LIFETIME = 86400; // 24 hours

    /**
     * Generate or retrieve CSRF token
     * Stores in cookie for double-submit validation
     */
    public static function generate()
    {
        // Reuse existing cookie token if present (so page loads don't invalidate it)
        if (!empty($_COOKIE[self::COOKIE_NAME])) {
            $token = $_COOKIE[self::COOKIE_NAME];
            // Validate format (64-char hex string)
            if (preg_match('/^[a-f0-9]{64}$/', $token)) {
                return $token;
            }
        }

        // Generate new token
        $token = bin2hex(random_bytes(32));

        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || ($_SERVER['SERVER_PORT'] ?? 80) == 443;

        setcookie(self::COOKIE_NAME, $token, [
            'expires' => time() + self::COOKIE_LIFETIME,
            'path' => '/',
            'domain' => '',
            'secure' => $isHttps,
            'httponly' => false,  // Allow JS to read for X-Csrf-Token header
            'samesite' => 'Lax'
        ]);

        // Also set in $_COOKIE for same-request reads
        $_COOKIE[self::COOKIE_NAME] = $token;

        return $token;
    }

    /**
     * Validate CSRF token using Double-Submit Cookie pattern
     * Compares the form-submitted token with the cookie token
     */
    public static function validate($formToken)
    {
        $cookieToken = $_COOKIE[self::COOKIE_NAME] ?? '';

        if (empty($cookieToken) || empty($formToken)) {
            return false;
        }

        return hash_equals($cookieToken, $formToken);
    }

    /**
     * Validate CSRF for JSON API requests
     * Checks X-Csrf-Token header first, then falls back to body param
     * 
     * Usage in JSON API:
     *   require_once CSRF.php;
     *   CSRF::validateRequest();  // exits with 403 if invalid
     */
    public static function validateRequest(): void
    {
        // GET/HEAD/OPTIONS are safe methods, skip CSRF check
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }

        $cookieToken = $_COOKIE[self::COOKIE_NAME] ?? '';
        if (empty($cookieToken)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'CSRF token missing']);
            exit;
        }

        // 1. Check X-Csrf-Token header (preferred for JSON APIs)
        $headerToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';

        // 2. Fallback: check POST body or JSON body
        if (empty($headerToken)) {
            $headerToken = $_POST['csrf_token'] ?? '';
        }

        if (empty($headerToken) || !hash_equals($cookieToken, $headerToken)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
            exit;
        }
    }

    /**
     * Regenerate CSRF token (call after successful validation for extra security)
     */
    public static function regenerate()
    {
        $token = bin2hex(random_bytes(32));

        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || ($_SERVER['SERVER_PORT'] ?? 80) == 443;

        setcookie(self::COOKIE_NAME, $token, [
            'expires' => time() + self::COOKIE_LIFETIME,
            'path' => '/',
            'domain' => '',
            'secure' => $isHttps,
            'httponly' => false,  // Allow JS to read for X-Csrf-Token header
            'samesite' => 'Lax'
        ]);

        $_COOKIE[self::COOKIE_NAME] = $token;
        return $token;
    }
}
