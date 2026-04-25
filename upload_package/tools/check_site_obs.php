<?php

/**
 * Quick diagnostic: check how many observations fall within ikan_hq boundary
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/SiteManager.php';
require_once __DIR__ . '/../libs/DataStore.php';

$siteId = 'ikan_hq';
$site = SiteManager::load($siteId);
if (!$site) {
    echo "Site not found\n";
    exit;
}

echo "Site: {$site['name']}\n";
echo "Center: " . json_encode($site['center']) . "\n";
echo "Geometry type: {$site['geometry']['type']}\n\n";

$allObs = DataStore::fetchAll('observations');
echo "Total observations: " . count($allObs) . "\n";

// Show first observation structure
if (!empty($allObs)) {
    $first = $allObs[0];
    echo "\nSample observation keys: " . implode(', ', array_keys($first)) . "\n";
    echo "Sample lat/lng: lat={$first['lat']}, lng={$first['lng']}\n";
    echo "Sample taxon: " . json_encode($first['taxon'] ?? 'N/A', JSON_UNESCAPED_UNICODE) . "\n";
    echo "Sample species_name: " . ($first['species_name'] ?? 'N/A') . "\n";
    echo "Sample site_id: " . ($first['site_id'] ?? 'N/A') . "\n";
}

// Count observations in site
$inSite = 0;
$latRange = [999, -999];
$lngRange = [999, -999];
foreach ($allObs as $obs) {
    $lat = floatval($obs['lat'] ?? 0);
    $lng = floatval($obs['lng'] ?? 0);
    if ($lat < $latRange[0]) $latRange[0] = $lat;
    if ($lat > $latRange[1]) $latRange[1] = $lat;
    if ($lng < $lngRange[0]) $lngRange[0] = $lng;
    if ($lng > $lngRange[1]) $lngRange[1] = $lng;

    if ($lat == 0 && $lng == 0) continue;

    if (SiteManager::isPointInGeometry($lat, $lng, $site['geometry'])) {
        $inSite++;
    }
}

echo "\nObservation lat range: [{$latRange[0]}, {$latRange[1]}]\n";
echo "Observation lng range: [{$lngRange[0]}, {$lngRange[1]}]\n";
echo "Observations in site: $inSite\n";
