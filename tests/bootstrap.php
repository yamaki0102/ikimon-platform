<?php
/**
 * PHPUnit Bootstrap
 */

// Set error reporting
error_reporting(E_ALL);

// Define test constants
define('TESTING', true);
define('DATA_DIR', __DIR__ . '/fixtures');
define('UPLOADS_DIR', __DIR__ . '/fixtures/uploads');

// Create fixtures directory if needed
if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0777, true);
}

// Load the autoloader
// Note: In a real setup, you'd use Composer's autoloader
// For now, we manually include required files

// Include libs
$libsDir = __DIR__ . '/../upload_package/libs';
foreach (glob($libsDir . '/*.php') as $file) {
    require_once $file;
}
