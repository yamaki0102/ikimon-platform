<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';

$all_obs = DataStore::fetchAll('observations');
foreach ($all_obs as $obs) {
    echo $obs['id'] . ' - user_id: ' . ($obs['user_id'] ?? 'null') . "\n";
}
