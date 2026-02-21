<?php

/**
 * get_strand_data.php — Strand Map API
 * 
 * Returns anonymized observation data as GeoJSON for the Strand Map
 * (heatmap visualization). All coordinates go through PrivacyFilter.
 *
 * GET params:
 *   - days (int)    : lookback period, default 30, max 90
 *   - site_id (str) : optional site filter
 *
 * Response: GeoJSON FeatureCollection
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300'); // 5-min cache

require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/PrivacyFilter.php';
require_once __DIR__ . '/../../libs/Auth.php';

Auth::init();

$days = min(max((int)($_GET['days'] ?? 30), 1), 90);
$siteId = $_GET['site_id'] ?? null;
$cutoff = date('Y-m-d\TH:i:s', strtotime("-{$days} days"));

// Fetch observations
$allObs = DataStore::fetchAll('observations');

$features = [];

foreach ($allObs as $obs) {
    // Skip if too old
    $obsDate = $obs['observed_at'] ?? $obs['created_at'] ?? '';
    if ($obsDate < $cutoff) continue;

    // Skip if no coordinates
    $lat = (float)($obs['latitude'] ?? $obs['location']['lat'] ?? 0);
    $lng = (float)($obs['longitude'] ?? $obs['location']['lng'] ?? 0);
    if ($lat === 0.0 && $lng === 0.0) continue;

    // Normalize for PrivacyFilter
    $obs['latitude'] = $lat;
    $obs['longitude'] = $lng;
    $obs['species_name'] = $obs['taxon']['name'] ?? '';

    // Apply privacy filter
    $filtered = PrivacyFilter::forAmbient($obs);

    // Build GeoJSON feature
    $features[] = [
        'type' => 'Feature',
        'geometry' => [
            'type' => 'Point',
            'coordinates' => [(float)$filtered['longitude'], (float)$filtered['latitude']]
        ],
        'properties' => [
            'cell_id'   => $filtered['cell_id'] ?? '',
            'grid_m'    => $filtered['grid_m'] ?? 1000,
            'taxon'     => $filtered['species_name'] ?? '',
            'has_photo' => !empty($obs['photos']),
            'status'    => !empty($obs['taxon']['id']) ? 'identified' : 'pending',
            'date'      => substr($filtered['observed_at'] ?? '', 0, 10),
            'protected' => $filtered['is_protected'] ?? false,
        ]
    ];
}

echo json_encode([
    'type' => 'FeatureCollection',
    'features' => $features,
    'meta' => [
        'count'  => count($features, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG),
        'days'   => $days,
        'cached' => date('c'),
    ]
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
