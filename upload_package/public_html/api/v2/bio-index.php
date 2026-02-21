<?php

/**
 * Phase 15: Spatial Biodiversity Index API (v2)
 *
 * Calculate Biodiversity Integrity Score (BIS) and summarize data
 * based on pure spatial coordinates (Lat/Lng) rather than predefined sites.
 * 
 * Usage:
 * /api/v2/bio-index.php?lat=34.710&lng=137.726&radius=5000 (radius in meters)
 */

require_once __DIR__ . '/../../../config/config.php';
require_once __DIR__ . '/../../../libs/DataStore.php';
require_once __DIR__ . '/../../../libs/GeoUtils.php';
require_once __DIR__ . '/../../../libs/BiodiversityScorer.php';

header('Content-Type: application/json; charset=utf-8');

// --- 1. Input Validation ---
$lat = isset($_GET['lat']) ? (float)$_GET['lat'] : null;
$lng = isset($_GET['lng']) ? (float)$_GET['lng'] : null;
$radius = isset($_GET['radius']) ? (int)$_GET['radius'] : 1000; // default 1km

// Enforce max radius to prevent memory exhaustion (MVP: 20km)
$MAX_RADIUS = 20000;
if ($radius > $MAX_RADIUS) {
    echo json_encode(['success' => false, 'message' => "Radius exceeds maximum limit of {$MAX_RADIUS}m."], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if ($lat === null || $lng === null) {
    echo json_encode(['success' => false, 'message' => 'lat and lng parameters are required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$validCoord = GeoUtils::validateCoordinates($lat, $lng);
if (!$validCoord['valid']) {
    echo json_encode(['success' => false, 'message' => 'Invalid coordinates: ' . $validCoord['reason']], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// --- 2. Data Retrieval & Spatial Filtering ---
// Note: MVP uses memory filtering. Future v2.x should use spatial indexing (e.g. PostGIS/Geohash)
$allObs = DataStore::fetchAll('observations');
$spatialObs = [];

foreach ($allObs as $obs) {
    $obsLat = $obs['location']['lat'] ?? null;
    $obsLng = $obs['location']['lng'] ?? null;

    if ($obsLat !== null && $obsLng !== null) {
        $distance = GeoUtils::distance($lat, $lng, $obsLat, $obsLng);
        if ($distance <= $radius) {
            $spatialObs[] = $obs;
        }
    }
}

// --- 3. Compute Metrics ---
// Calculate approximate area in hectares for density scoring
$areaHa = (pi() * pow($radius, 2)) / 10000;

// MVP limitation: BiodiversityScorer calculates Red List using $obs metadata, 
// which is currently appended during import. Future versions should do real-time
// Point-in-Polygon checks against regional Red List GeoJSON bounds here.
$scoreData = BiodiversityScorer::calculate($spatialObs, ['area_ha' => $areaHa]);

// Top species are now structured objects with Immutable Taxon Concept IDs
// This guarantees data integrity for 100 years even if scientific names change or species go extinct/reclassified.
$topSpecies = $scoreData['top_species'] ?? [];

// --- 4. Time-Series Summary (Preparation for Phase 16) ---
// Temporary simple year-over-year calculation
$currentYear = (int)date('Y');
$obsThisYear = 0;
$obsLastYear = 0;

foreach ($spatialObs as $obs) {
    $date = $obs['observed_at'] ?? $obs['date'] ?? null;
    if ($date) {
        $y = (int)substr($date, 0, 4);
        if ($y === $currentYear) $obsThisYear++;
        if ($y === ($currentYear - 1)) $obsLastYear++;
    }
}

// Prepare JSON response
$response = [
    'success' => true,
    'query' => [
        'lat' => $lat,
        'lng' => $lng,
        'radius_m' => $radius,
        'area_ha' => round($areaHa, 2)
    ],
    'index' => [
        'bis_score' => $scoreData['total_score'],
        'evaluation' => $scoreData['evaluation'],
        'shannon_index' => $scoreData['shannon_index'],
        'species_count' => $scoreData['species_count'],
        'total_observations' => count($spatialObs),
        'redlist_species_count' => count($scoreData['breakdown']['conservation_value']['matches'] ?? [])
    ],
    'time_series_baseline' => [
        'observations_this_year' => $obsThisYear,
        'observations_last_year' => $obsLastYear,
        'yoy_trend' => ($obsLastYear > 0) ? round((($obsThisYear - $obsLastYear) / $obsLastYear) * 100, 1) . '%' : 'N/A'
    ],
    'top_species' => $topSpecies,
    'bis_breakdown' => $scoreData['breakdown']
];

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_PRETTY_PRINT);
