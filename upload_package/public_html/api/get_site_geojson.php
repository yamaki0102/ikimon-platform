<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/CorporateSites.php';

header('Content-Type: application/json');

$siteId = $_GET['id'] ?? 'ikimon_forest';
$site = CorporateSites::SITES[$siteId] ?? null;

if (!$site) {
    echo json_encode(['type' => 'FeatureCollection', 'features' => []]);
    exit;
}

// Fetch all observations (In V3, use spatial query. V2.5 uses simple filter)
$all_obs = DataStore::fetchAll('observations');
$features = [];

foreach ($all_obs as $obs) {
    // Filter by Site ID
    if (isset($obs['site_id']) && $obs['site_id'] === $siteId) {
        
        $color = '#22c55e'; // Default Green (Wild)
        if (($obs['cultivation'] ?? '') !== 'wild') $color = '#eab308'; // Yellow (Planted)
        if (($obs['status'] ?? '') === 'unidentified') $color = '#9ca3af'; // Gray

        $features[] = [
            'type' => 'Feature',
            'geometry' => [
                'type' => 'Point',
                'coordinates' => [ (float)$obs['lng'], (float)$obs['lat'] ]
            ],
            'properties' => [
                'id' => $obs['id'],
                'name' => $obs['taxon']['name'] ?? 'Unknown',
                'scientific_name' => $obs['taxon']['scientific_name'] ?? '',
                'image' => $obs['photos'][0] ?? '',
                'color' => $color,
                'status' => $obs['status'] ?? 'verified'
            ]
        ];
    }
}

// Add Site Polygon (Area Boundary)
$polygonFeature = [
    'type' => 'Feature',
    'geometry' => [
        'type' => 'Polygon',
        'coordinates' => [ $site['polygon'] ]
    ],
    'properties' => [
        'type' => 'boundary',
        'name' => $site['name']
    ]
];
array_unshift($features, $polygonFeature);

echo json_encode([
    'type' => 'FeatureCollection',
    'features' => $features
]);
