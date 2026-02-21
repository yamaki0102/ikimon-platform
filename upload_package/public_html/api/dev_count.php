<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';

$all = DataStore::fetchAll('observations');
$u = array_filter($all, function ($o) {
    return isset($o['user_id']) && $o['user_id'] === 'user_ya_001';
});
echo count($u);
