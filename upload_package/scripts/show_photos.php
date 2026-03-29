<?php
require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/DataStore.php';

$obsId = $argv[1] ?? '';
$obs = DataStore::findById('observations', $obsId);
if (!$obs) { echo "NOT FOUND\n"; exit(1); }

foreach ($obs['photos'] ?? [] as $p) {
    echo $p . "\n";
    $full = PUBLIC_DIR . '/' . ltrim($p, '/');
    echo "  exists: " . (is_file($full) ? 'YES' : 'NO') . " size: " . (is_file($full) ? filesize($full) : 0) . "\n";
}
echo "notes: " . ($obs['notes'] ?? 'none') . "\n";
echo "location: " . ($obs['location']['name'] ?? 'none') . "\n";
echo "date: " . ($obs['observed_at'] ?? $obs['created_at'] ?? 'unknown') . "\n";
