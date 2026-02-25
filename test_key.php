<?php
require_once __DIR__ . '/upload_package/config/config.php';
require_once __DIR__ . '/upload_package/libs/DataStore.php';

$rawKey = 'test_enterprise_940245a9f27112fb6';
$keyHash = hash('sha256', $rawKey);

$keys = DataStore::fetchAll('api_keys');

// Remove existing ones
$keys = array_filter($keys, function ($k) {
    return strpos($k['id'], 'key_') !== 0 || $k['organization'] !== 'Test Enterprise Inc.';
});

$keyData = [
    'id' => 'key_6998f3fe70de7',
    'organization' => 'Test Enterprise Inc.',
    'tier' => 'enterprise',
    'key_hash' => $keyHash,
    'status' => 'active',
    'created_at' => date('Y-m-d H:i:s'),
    'usage_count' => 0
];
$keys[] = $keyData;

DataStore::save('api_keys', array_values($keys));
echo "API Key Generated: $rawKey\nHash: $keyHash\n";
