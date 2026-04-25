<?php

/**
 * Health Check API
 * GET /api/health.php
 * 
 * Returns system status for monitoring.
 * No authentication required.
 */

require_once __DIR__ . '/../../config/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache');

$checks = [];
$healthy = true;

// 1. Data directory writable
$dataWritable = is_writable(DATA_DIR);
$checks['data_writable'] = $dataWritable;
if (!$dataWritable) $healthy = false;

// 2. Observations file exists and readable
$obsFile = DATA_DIR . '/observations.json';
$obsExists = file_exists($obsFile) && is_readable($obsFile);
$checks['observations_readable'] = $obsExists;

// 3. Disk space (warn if < 100MB free)
$freeBytes = @disk_free_space(ROOT_DIR);
$freeMB = $freeBytes ? round($freeBytes / 1024 / 1024) : 0;
$checks['disk_free_mb'] = $freeMB;
if ($freeMB < 100) $healthy = false;

// 4. PHP version
$checks['php_version'] = PHP_VERSION;

// 5. Required extensions
$requiredExts = ['json', 'mbstring', 'openssl'];
$missingExts = [];
foreach ($requiredExts as $ext) {
    if (!extension_loaded($ext)) {
        $missingExts[] = $ext;
    }
}
$checks['missing_extensions'] = $missingExts;
if (!empty($missingExts)) $healthy = false;

// 6. Config loaded
$checks['config_loaded'] = defined('ROOT_DIR') && defined('DATA_DIR');

// 7. Timestamp
$checks['server_time'] = date('c');
$checks['timezone'] = date_default_timezone_get();

// Response
http_response_code($healthy ? 200 : 503);
echo json_encode([
    'status' => $healthy ? 'healthy' : 'degraded',
    'checks' => $checks
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
