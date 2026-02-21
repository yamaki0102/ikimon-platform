<?php

/**
 * Inspect observation data structure for migration planning
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';

$obs = DataStore::fetchAll('observations');
echo "Total observations: " . count($obs) . "\n";

$mr = 0;
$ms = 0;
$mt = 0;
$ft = 0;
$mi = 0;
foreach ($obs as $o) {
    $t = $o['taxon'] ?? [];
    if (empty($t['rank'])) $mr++;
    if (empty($t['source'])) $ms++;
    if (empty($t['thumbnail_url'])) $mt++;
    if (empty($t['inat_taxon_id'])) $mi++;
    if (($t['source'] ?? '') === 'freetext') $ft++;
}

echo "Missing rank: $mr\n";
echo "Missing source: $ms\n";
echo "Missing thumbnail: $mt\n";
echo "Missing inat_taxon_id: $mi\n";
echo "Freetext source: $ft\n";

// Show sample taxon structures (first 3)
echo "\n=== Sample Taxon Structures ===\n";
foreach (array_slice($obs, 0, 3) as $i => $o) {
    echo "--- Observation #$i (id: " . ($o['id'] ?? '?') . ") ---\n";
    echo json_encode($o['taxon'] ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
}
