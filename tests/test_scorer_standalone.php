<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$baseDir = __DIR__ . '/../upload_package/libs';

echo "1. Loading RedListManager...\n";
require_once $baseDir . '/RedListManager.php';
if (class_exists('RedListManager')) {
    echo "PASS: RedListManager loaded.\n";
} else {
    echo "FAIL: RedListManager class not found.\n";
}

echo "2. Loading BiodiversityScorer...\n";
require_once $baseDir . '/BiodiversityScorer.php';
if (class_exists('BiodiversityScorer')) {
    echo "PASS: BiodiversityScorer loaded.\n";
} else {
    echo "FAIL: BiodiversityScorer class not found.\n";
}

echo "3. Instantiating Scorer...\n";
// It's static, but let's check
try {
    $res = BiodiversityScorer::calculate([], []);
    echo "PASS: Calculate called. Score: " . $res['total_score'] . "\n";
} catch (Throwable $e) {
    echo "FAIL: Scorer execution failed: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
