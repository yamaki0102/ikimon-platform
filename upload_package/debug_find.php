<?php
require_once __DIR__ . '/libs/DataStore.php';

echo "Testing findById...\n";
$id = 'obs_69548f9a5604d';
$res = DataStore::findById('observations', $id);
if ($res) {
    echo "FOUND: " . $res['id'] . "\n";
} else {
    echo "NOT FOUND: $id\n";
    // Try clean ID
    $clean = str_replace('obs_', '', $id);
    $res2 = DataStore::findById('observations', $clean);
    if ($res2) {
        echo "FOUND CLEAN: " . $res2['id'] . "\n";
    } else {
        echo "NOT FOUND CLEAN: $clean\n";
    }
}

echo "Testing Glob...\n";
$dir = __DIR__ . '/data/observations';
$files = glob($dir . '/*.json');
echo "Files found: " . count($files) . "\n";
foreach ($files as $f) {
    echo basename($f) . "\n";
}
