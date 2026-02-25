<?php
// Run from upload_package root
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';

$obs = DataStore::fetchAll('observations');
$total = count($obs);
$withSlug = 0;
$withTaxon = 0;
$missingSlug = [];

foreach ($obs as $o) {
    if (!empty($o['taxon']['slug'])) $withSlug++;
    if (!empty($o['taxon']['name'])) $withTaxon++;
    if (!empty($o['taxon']['name']) && empty($o['taxon']['slug'])) {
        $missingSlug[] = $o['taxon']['name'];
    }
}

echo "Total observations: $total\n";
echo "With taxon name: $withTaxon\n";
echo "With slug: $withSlug\n";
echo "Missing slug (have name): " . count($missingSlug) . "\n";
if ($missingSlug) {
    $unique = array_unique($missingSlug);
    echo "Unique names (" . count($unique) . "): " . implode(', ', $unique) . "\n";
}
