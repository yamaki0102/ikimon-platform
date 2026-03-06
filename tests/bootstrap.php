<?php
/**
 * PHPUnit Bootstrap
 */

// Set error reporting
error_reporting(E_ALL);

// Define test constants
define('TESTING', true);
if (!defined('APP_NAME')) define('APP_NAME', 'ikimon-test');
if (!defined('ROOT_DIR')) define('ROOT_DIR', dirname(__DIR__) . '/upload_package');
if (!defined('DATA_DIR')) define('DATA_DIR', __DIR__ . '/fixtures');
if (!defined('LIBS_DIR')) define('LIBS_DIR', ROOT_DIR . '/libs');
if (!defined('PUBLIC_DIR')) define('PUBLIC_DIR', ROOT_DIR . '/public_html');
if (!defined('NOINDEX_SITE')) define('NOINDEX_SITE', true);
if (!defined('BASE_URL')) define('BASE_URL', 'http://localhost');
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
