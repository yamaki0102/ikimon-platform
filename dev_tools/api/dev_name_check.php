<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';

$all = DataStore::getLatest('observations', 20);
foreach ($all as $o) {
    if (isset($o['user_id']) && $o['user_id'] === 'user_ya_001') {
        echo $o['id'] . " : " . ($o['user_name'] ?? 'NONE') . "\n";
    }
}
