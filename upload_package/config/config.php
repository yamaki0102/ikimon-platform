<?php

/**
 * ikimon Global Configuration
 */

// Guard against duplicate inclusion (PHP 9: redefining constants is a fatal error)
if (defined('APP_NAME')) return;

// Paths
define('ROOT_DIR', dirname(__DIR__));

if (!function_exists('ikimon_runtime_root')) {
    function ikimon_runtime_root(): string
    {
        $configured = getenv('IKIMON_RUNTIME_ROOT')
            ?: ($_SERVER['IKIMON_RUNTIME_ROOT'] ?? ($_ENV['IKIMON_RUNTIME_ROOT'] ?? ''));

        if (is_string($configured) && trim($configured) !== '') {
            return rtrim(str_replace('\\', '/', trim($configured)), '/');
        }

        $repoRoot = dirname(ROOT_DIR);
        $appRoot = dirname($repoRoot);
        $candidate = $appRoot . '/persistent';

        if (basename($appRoot) === 'ikimon.life-staging' && is_dir($candidate)) {
            return $candidate;
        }

        return '';
    }
}

$runtimeRoot = ikimon_runtime_root();
define('IKIMON_RUNTIME_ROOT', $runtimeRoot);
define('IKIMON_RUNTIME_CONFIG_DIR', IKIMON_RUNTIME_ROOT !== '' ? IKIMON_RUNTIME_ROOT . '/config' : __DIR__);

// Load runtime secrets early (before constants that may be overridden).
$runtimeSecret = IKIMON_RUNTIME_CONFIG_DIR . '/secret.php';
if (is_file($runtimeSecret)) {
    require_once $runtimeSecret;
} elseif (is_file(__DIR__ . '/secret.php')) {
    require_once __DIR__ . '/secret.php';
}

// Basic Settings
define('APP_NAME', 'ikimon');
define('APP_VERSION', '0.4.0');
define('NOINDEX_SITE', defined('NOINDEX_SITE_OVERRIDE') ? NOINDEX_SITE_OVERRIDE : true);

define('DATA_DIR', IKIMON_RUNTIME_ROOT !== '' ? IKIMON_RUNTIME_ROOT . '/data' : ROOT_DIR . '/data');
define('LIBS_DIR', ROOT_DIR . '/libs');
define('PUBLIC_DIR', ROOT_DIR . '/public_html');
define('UPLOADS_DIR', IKIMON_RUNTIME_ROOT !== '' ? IKIMON_RUNTIME_ROOT . '/uploads' : PUBLIC_DIR . '/uploads');

if (!function_exists('app_public_path')) {
    function app_public_path(string $path = ''): string
    {
        $relative = ltrim(str_replace('\\', '/', $path), '/');
        if ($relative === '') {
            return PUBLIC_DIR;
        }

        if ($relative === 'uploads' || str_starts_with($relative, 'uploads/')) {
            return UPLOADS_DIR . substr($relative, strlen('uploads'));
        }

        return PUBLIC_DIR . '/' . $relative;
    }
}

if (!function_exists('app_upload_path')) {
    function app_upload_path(string $path = ''): string
    {
        $relative = ltrim(str_replace('\\', '/', $path), '/');
        if (str_starts_with($relative, 'uploads/')) {
            $relative = substr($relative, strlen('uploads/'));
        }

        return $relative === '' ? UPLOADS_DIR : UPLOADS_DIR . '/' . $relative;
    }
}

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
$normalizedHost = strtolower(preg_replace('/:\d+$/', '', $host));
$isStagingHost = str_contains($normalizedHost, 'sslip.io')
    || str_contains($normalizedHost, 'nip.io')
    || str_starts_with($normalizedHost, 'staging.')
    || $normalizedHost === 'localhost'
    || $normalizedHost === '127.0.0.1';
$requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
$requestPath = (string) (parse_url($requestUri, PHP_URL_PATH) ?: '/');
$appBasePath = '';
if (preg_match('#^/(v[0-9]+)(?:/|$)#i', $requestPath, $matches) === 1) {
    $appBasePath = '/' . strtolower($matches[1]);
}
if (strpos($host, 'ikimon.life') !== false) {
    $protocol = 'https';
}
define('BASE_ORIGIN', $protocol . '://' . $host);
define('APP_BASE_PATH', $appBasePath);
define('BASE_URL', BASE_ORIGIN . APP_BASE_PATH);
define('APP_BASE_URL', BASE_URL);
define('IS_STAGING_SITE', $isStagingHost);
define('RUNTIME_ENV_LABEL', IS_STAGING_SITE ? 'staging' : 'production');

if (!function_exists('app_path')) {
    function app_path(string $path = '/'): string
    {
        if ($path === '') {
            return APP_BASE_PATH !== '' ? APP_BASE_PATH : '/';
        }

        if (preg_match('#^(?:https?:)?//#i', $path) === 1) {
            return $path;
        }

        if ($path[0] !== '/') {
            $path = '/' . $path;
        }

        if (APP_BASE_PATH !== '' && ($path === APP_BASE_PATH || str_starts_with($path, APP_BASE_PATH . '/'))) {
            return $path;
        }

        return APP_BASE_PATH . $path;
    }
}

if (!function_exists('app_url')) {
    function app_url(string $path = '/'): string
    {
        return BASE_ORIGIN . app_path($path);
    }
}

if (
    PHP_SAPI !== 'cli'
    && APP_BASE_PATH !== ''
    && !headers_sent()
    && !defined('APP_BASE_PATH_OUTPUT_BUFFER_REGISTERED')
    && !str_starts_with($requestPath, APP_BASE_PATH . '/api/')
    && !str_starts_with($requestPath, '/api/')
    && stripos((string) ($_SERVER['HTTP_ACCEPT'] ?? ''), 'text/html') !== false
) {
    define('APP_BASE_PATH_OUTPUT_BUFFER_REGISTERED', true);
    ob_start(static function (string $buffer): string {
        $prefix = APP_BASE_PATH;
        if ($prefix === '') {
            return $buffer;
        }

        $patterns = [
            '#(?<attr>\b(?:href|src|action|formaction|poster)\s*=\s*["\'])(?<path>/(?!/|v[0-9]+/|v[0-9]+$))#i',
            '#(?<fn>\b(?:fetch|import|location(?:\.href)?\.assign|location(?:\.href)?\.replace|window\.open)\s*\(\s*["\'])(?<path>/(?!/|v[0-9]+/))#i',
            '#(?<eq>\b(?:location(?:\.href)?|window\.location(?:\.href)?|document\.location(?:\.href)?)\s*=\s*["\'])(?<path>/(?!/|v[0-9]+/))#i',
            '#(?<css>url\(\s*["\']?)(?<path>/(?!/|v[0-9]+/))#i',
        ];

        foreach ($patterns as $pattern) {
            $buffer = preg_replace_callback(
                $pattern,
                static function (array $matches) use ($prefix): string {
                    $lead = $matches['attr'] ?? $matches['fn'] ?? $matches['eq'] ?? $matches['css'] ?? '';
                    return $lead . $prefix . $matches['path'];
                },
                $buffer
            ) ?? $buffer;
        }

        return $buffer;
    });
}

// Canonical migration feature flags
define('CANONICAL_DUAL_WRITE_ENABLED', defined('CANONICAL_DUAL_WRITE_ENABLED_OVERRIDE') ? CANONICAL_DUAL_WRITE_ENABLED_OVERRIDE : true);
define('CANONICAL_READ_PILOT_ENABLED', defined('CANONICAL_READ_PILOT_ENABLED_OVERRIDE') ? CANONICAL_READ_PILOT_ENABLED_OVERRIDE : true);

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
