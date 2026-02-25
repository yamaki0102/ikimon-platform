<?php
$url = 'http://localhost:8899/api/test_concurrency.php';
$requests = 100;

echo "Starting stress test with $requests concurrent requests to $url\n";

$mh = curl_multi_init();
$chArray = [];

for ($i = 0; $i < $requests; $i++) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_multi_add_handle($mh, $ch);
    $chArray[] = $ch;
}

$running = null;
do {
    curl_multi_exec($mh, $running);
    curl_multi_select($mh);
} while ($running > 0);

$responses = [];
foreach ($chArray as $ch) {
    // curl_multi_getcontent($ch); // Discarding responses to avoid memory bloat
    curl_multi_remove_handle($mh, $ch);
}
curl_multi_close($mh);

echo "\nCompleted $requests requests.\n";

// Small delay to allow filesystem locks to flush completely
usleep(200000); // 0.2s

// Validate results directly from DataStore logic
require_once __DIR__ . '/../upload_package/config/config.php';
require_once __DIR__ . '/../upload_package/libs/DataStore.php';

$countData = DataStore::getCounts('stress_test', 'target');
$hits = $countData['hits'] ?? 0;
echo "Final Counter Value: $hits (Expected: $requests)\n";

$month = date('Y-m');
$appends = DataStore::get("stress_test_appends/{$month}");
$appendCount = count($appends);
echo "Final Appended Items: $appendCount (Expected: $requests)\n";

if ($hits == $requests && $appendCount == $requests) {
    echo "✅ STRESS TEST PASSED: No data loss during concurrent writes.\n";
} else {
    echo "❌ STRESS TEST FAILED: Data loss detected! Race condition exists.\n";
}
