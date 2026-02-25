<?php
require_once __DIR__ . '/../upload_package/config/config.php';

$countFile = DATA_DIR . '/counts/stress_test/target.json';
if (file_exists($countFile)) {
    unlink($countFile);
}

$month = date('Y-m');
$appendFile = DATA_DIR . "/stress_test_appends/{$month}.json";
if (file_exists($appendFile)) {
    unlink($appendFile);
}

echo "Cleaned up old test data.\n";
