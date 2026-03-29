<?php

/**
 * ikimon Global Configuration
 */

// Guard against duplicate inclusion (PHP 9: redefining constants is a fatal error)
if (defined('APP_NAME')) return;

// Load local secrets early (before constants that may be overridden)
if (file_exists(__DIR__ . '/secret.php')) {
    require_once __DIR__ . '/secret.php';
}

// Basic Settings
define('APP_NAME', 'ikimon');
define('APP_VERSION', '0.4.0');
define('NOINDEX_SITE', defined('NOINDEX_SITE_OVERRIDE') ? NOINDEX_SITE_OVERRIDE : true);

// Paths
define('ROOT_DIR', dirname(__DIR__));
define('DATA_DIR', ROOT_DIR . '/data');
define('LIBS_DIR', ROOT_DIR . '/libs');
define('PUBLIC_DIR', ROOT_DIR . '/public_html');

// Session Security (must be set before session_start)
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_secure', 1);
    ini_set('session.cookie_httponly', 1);
    ini_set('session.cookie_samesite', 'Lax');
    ini_set('session.use_strict_mode', 1);
}

// CSP Nonce (available globally for inline script nonce attributes)
require_once LIBS_DIR . '/CspNonce.php';
CspNonce::sendHeader();

// URLs — Force HTTPS in production (prevents Mixed Content)
$is_https = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on')
         || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
         || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);
$protocol = $is_https ? 'https' : 'http';
// Force HTTPS on production domain
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
if (strpos($host, 'ikimon.life') !== false) {
    $protocol = 'https';
}
define('BASE_URL', $protocol . '://' . $host);

// Red List Obscuring Settings
define('OBSCURE_GRID_CR_EN', 10000); // 10km
define('OBSCURE_GRID_VU', 1000);    // 1km

// AI Settings (fallback to $_SERVER and $_ENV, or constant if defined in secret.php)
$geminiApiKey = defined('GEMINI_API_KEY_SECRET') ? GEMINI_API_KEY_SECRET : (getenv('GEMINI_API_KEY') ?: '');
if (!$geminiApiKey) $geminiApiKey = $_SERVER['GEMINI_API_KEY'] ?? ($_ENV['GEMINI_API_KEY'] ?? '');
define('GEMINI_API_KEY', $geminiApiKey);

$openaiApiKey = defined('OPENAI_API_KEY_SECRET') ? OPENAI_API_KEY_SECRET : (getenv('OPENAI_API_KEY') ?: '');
if (!$openaiApiKey) $openaiApiKey = $_SERVER['OPENAI_API_KEY'] ?? ($_ENV['OPENAI_API_KEY'] ?? '');
define('OPENAI_API_KEY', $openaiApiKey);

// Image Settings
define('IMAGE_MAX_WIDTH', 1280);
define('IMAGE_QUALITY', 80);
define('IMAGE_TARGET_SIZE_KB', 500);

// Errors
error_reporting(E_ALL);
ini_set('display_errors', 0); // Production default

// Timezone
date_default_timezone_set('Asia/Tokyo');
