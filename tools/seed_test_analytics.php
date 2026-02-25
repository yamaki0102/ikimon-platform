<?php
$dir = __DIR__ . '/../upload_package/data/analytics';
if (!is_dir($dir)) mkdir($dir, 0777, true);
$today = date('Y-m-d');
$data = [
    ['event' => 'page_view', 'data' => (object)[], 'page' => 'index', 'session_id' => 'sess_test1_123', 'timestamp' => '2026-02-12T09:00:00Z', 'viewport' => '375x812', 'referrer' => '', 'ip_hash' => 'abcd1234', 'ua_short' => 'Test'],
    ['event' => 'page_view', 'data' => (object)[], 'page' => 'post', 'session_id' => 'sess_test1_123', 'timestamp' => '2026-02-12T09:01:00Z', 'viewport' => '375x812', 'referrer' => '/index', 'ip_hash' => 'abcd1234', 'ua_short' => 'Test'],
    ['event' => 'post_start', 'data' => (object)[], 'page' => 'post', 'session_id' => 'sess_test1_123', 'timestamp' => '2026-02-12T09:02:00Z', 'viewport' => '375x812', 'referrer' => '', 'ip_hash' => 'abcd1234', 'ua_short' => 'Test'],
    ['event' => 'photo_added', 'data' => ['count' => 1], 'page' => 'post', 'session_id' => 'sess_test1_123', 'timestamp' => '2026-02-12T09:03:00Z', 'viewport' => '375x812', 'referrer' => '', 'ip_hash' => 'abcd1234', 'ua_short' => 'Test'],
    ['event' => 'post_submit', 'data' => ['photo_count' => 1], 'page' => 'post', 'session_id' => 'sess_test1_123', 'timestamp' => '2026-02-12T09:04:00Z', 'viewport' => '375x812', 'referrer' => '', 'ip_hash' => 'abcd1234', 'ua_short' => 'Test'],
    ['event' => 'post_success', 'data' => ['obs_id' => 'obs_001'], 'page' => 'post', 'session_id' => 'sess_test1_123', 'timestamp' => '2026-02-12T09:05:00Z', 'viewport' => '375x812', 'referrer' => '', 'ip_hash' => 'abcd1234', 'ua_short' => 'Test'],
    ['event' => 'page_view', 'data' => (object)[], 'page' => 'index', 'session_id' => 'sess_test2_456', 'timestamp' => '2026-02-12T10:00:00Z', 'viewport' => '1440x900', 'referrer' => '', 'ip_hash' => 'efgh5678', 'ua_short' => 'Test2'],
    ['event' => 'page_view', 'data' => (object)[], 'page' => 'post', 'session_id' => 'sess_test2_456', 'timestamp' => '2026-02-12T10:01:00Z', 'viewport' => '1440x900', 'referrer' => '/index', 'ip_hash' => 'efgh5678', 'ua_short' => 'Test2'],
    ['event' => 'post_start', 'data' => (object)[], 'page' => 'post', 'session_id' => 'sess_test2_456', 'timestamp' => '2026-02-12T10:02:00Z', 'viewport' => '1440x900', 'referrer' => '', 'ip_hash' => 'efgh5678', 'ua_short' => 'Test2'],
    ['event' => 'photo_added', 'data' => ['count' => 1], 'page' => 'post', 'session_id' => 'sess_test2_456', 'timestamp' => '2026-02-12T10:03:00Z', 'viewport' => '1440x900', 'referrer' => '', 'ip_hash' => 'efgh5678', 'ua_short' => 'Test2']
];
file_put_contents($dir . '/' . $today . '.json', json_encode($data, JSON_UNESCAPED_UNICODE));
echo "Created: $dir/$today.json (" . count($data) . " events)\n";
