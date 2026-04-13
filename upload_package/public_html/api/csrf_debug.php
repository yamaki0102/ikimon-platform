<?php
// CSRF Debug - temporary diagnostic
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/CSRF.php';

header('Content-Type: application/json; charset=utf-8');

$cookieToken = $_COOKIE['ikimon_csrf'] ?? '(empty)';
$headerToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '(empty)';
$metaToken = CSRF::generate();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$allCookies = array_keys($_COOKIE);

echo json_encode([
    'method' => $method,
    'cookie_token' => substr($cookieToken, 0, 16) . '...',
    'header_token' => substr($headerToken, 0, 16) . '...',
    'generated_token' => substr($metaToken, 0, 16) . '...',
    'cookie_matches_header' => hash_equals($cookieToken, $headerToken),
    'cookie_matches_generated' => hash_equals($cookieToken, $metaToken),
    'all_cookies' => $allCookies,
    'header_keys' => array_filter(array_keys($_SERVER), fn($k) => str_starts_with($k, 'HTTP_X_')),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
