<?php
require_once __DIR__ . '/upload_package/config/config.php';
require_once __DIR__ . '/upload_package/libs/DataStore.php';

// Manually seed corporations.json
$file = 'corporations.json';
$data = [
    [
        'id' => '1',
        'name' => '愛管株式会社 (Aikan Co., Ltd.)',
        'plan' => 'enterprise',
        'created_at' => date('Y-m-d H:i:s'),
        'members' => [
            'user_ya_001' => ['role' => 'admin', 'joined_at' => date('Y-m-d H:i:s')]
        ]
    ]
];

DataStore::save($file, $data);
echo "Seeded {$file} with Aikan Co., Ltd. (ID: 1)\n";
