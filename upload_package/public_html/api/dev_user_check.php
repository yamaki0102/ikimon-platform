<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';

$user = DataStore::findById('users', 'user_ya_001');
print_r($user);
