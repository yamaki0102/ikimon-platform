<?php
require_once __DIR__ . '/public_html/libs/bootstrap.php';

$ids = ['8cdfc85cc6690981', 'a85a5b3bee0e62c0'];
foreach ($ids as $id) {
    $obs = DataStore::findById('observations', $id);
    if ($obs) {
        echo "FOUND: $id (user: {$obs['user_id']})\n";
    } else {
        echo "DELETED: $id (not found)\n";
    }
}

$cacheFiles = glob(__DIR__ . '/data/cache/*.cache');
echo "Cache files remaining: " . count($cacheFiles) . "\n";
