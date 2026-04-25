<?php

/**
 * CSP Violation Report Endpoint
 * 
 * Receives Content-Security-Policy violation reports from browsers
 * and logs them for monitoring. Silent endpoint — always returns 204.
 */

// No session needed, no auth needed — this is a browser-initiated report
header('Content-Type: application/json; charset=utf-8');

$input = file_get_contents('php://input');
if (empty($input)) {
    http_response_code(204);
    exit;
}

$report = json_decode($input, true);
if (!$report) {
    http_response_code(204);
    exit;
}

// Extract the actual report (may be wrapped in csp-report or body)
$violation = $report['csp-report'] ?? $report['body'] ?? $report;

$logEntry = [
    'time' => date('Y-m-d H:i:s'),
    'blocked' => $violation['blocked-uri'] ?? $violation['blockedURL'] ?? 'unknown',
    'directive' => $violation['violated-directive'] ?? $violation['effectiveDirective'] ?? 'unknown',
    'source' => $violation['source-file'] ?? $violation['sourceFile'] ?? 'unknown',
    'line' => $violation['line-number'] ?? $violation['lineNumber'] ?? 0,
    'page' => $violation['document-uri'] ?? $violation['documentURL'] ?? 'unknown',
];

// Log to data directory (max 1MB, rotate)
$logDir = defined('DATA_DIR') ? DATA_DIR : dirname(__DIR__, 2) . '/data';
$logFile = $logDir . '/csp_violations.log';

// Rotate if > 1MB
if (file_exists($logFile) && filesize($logFile) > 1048576) {
    rename($logFile, $logFile . '.old');
}

@file_put_contents(
    $logFile,
    json_encode($logEntry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) . "\n",
    FILE_APPEND | LOCK_EX
);

http_response_code(204);
