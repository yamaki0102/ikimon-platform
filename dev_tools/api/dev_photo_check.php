<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';

$all = DataStore::fetchAll('observations');
foreach ($all as $o) {
    if (isset($o['user_id']) && $o['user_id'] === 'user_ya_001') {
        if (empty($o['photos'])) {
            echo "NO PHOTOS on " . $o['id'] . "\n";
        }
    }
}
