<?php
require_once __DIR__ . '/upload_package/config/config.php';
require_once __DIR__ . '/upload_package/libs/DataStore.php';

$rawKey = 'test_enterprise_' . bin2hex(random_bytes(8));
$keyHash = hash('sha256', $rawKey);
$keyData = [
    'id' => 'key_' . uniqid(),
    'organization' => 'Test Enterprise Inc.',
    'tier' => 'enterprise',
    'key_hash' => $keyHash,
    'status' => 'active',
    'created_at' => date('Y-m-d H:i:s'),
    'usage_count' => 0
];
DataStore::upsert('api_keys', $keyData);
echo $rawKey;
