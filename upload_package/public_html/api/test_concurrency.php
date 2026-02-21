<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';

// Simulate a heavy concurrent write by incrementing a counter
$newCount = DataStore::increment('stress_test', 'target', 'hits');

// Also do an append to test list appending concurrency
DataStore::append('stress_test_appends', ['timestamp' => microtime(true), 'pid' => getmypid()]);

echo json_encode(['success' => true, 'count' => $newCount]);
