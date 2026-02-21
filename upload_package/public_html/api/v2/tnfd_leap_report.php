<?php

/**
 * Phase C1: TNFD LEAP Report API (v2)
 *
 * Generate institutional-grade reports following the LEAP framework:
 * 1. Locate (Discover interface with nature)
 * 2. Evaluate (Examine dependencies & impacts)
 * 3. Assess (Mitigate risks and opportunities)
 * 4. Prepare (Respond and report)
 *
 * This API currently focuses on Locate & Evaluate/Assess phases based on observation data.
 * Requires 'enterprise' tier API Key.
 *
 * Usage:
 * /api/v2/tnfd_leap_report.php?lat=34.710&lng=137.726&radius=5000
 */

require_once __DIR__ . '/../../../config/config.php';
require_once __DIR__ . '/../../../libs/DataStore.php';
require_once __DIR__ . '/../../../libs/GeoUtils.php';
require_once __DIR__ . '/../../../libs/BiodiversityScorer.php';
require_once __DIR__ . '/../../../libs/ApiGate.php';

header('Content-Type: application/json; charset=utf-8');

// --- 0. Authorization ---
// Enterprise tier required for TNFD LEAP Reports
$gateInfo = ApiGate::check('enterprise');

// --- 1. Input Validation (Locate Phase) ---
$lat = isset($_GET['lat']) ? (float)$_GET['lat'] : null;
$lng = isset($_GET['lng']) ? (float)$_GET['lng'] : null;
$radius = isset($_GET['radius']) ? (int)$_GET['radius'] : 1000;

$MAX_RADIUS = 50000; // 50km for enterprise
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

// --- 2. Data Aggregation ---
$allObs = DataStore::fetchAll('observations');
$spatialObs = [];
$threatenedObs = [];
$nonNativeObs = [];

foreach ($allObs as $obs) {
    // Only use 'Research Grade' or conceptually robust data for institutional reporting
    // Or we could use all data but flag the quality. For MVP, we filter by has_location and is_organism.
    if (empty($obs['quality_flags']['has_location']) || empty($obs['quality_flags']['is_organism'])) {
        continue;
    }

    $obsLat = $obs['location']['lat'] ?? $obs['lat'] ?? null;
    $obsLng = $obs['location']['lng'] ?? $obs['lng'] ?? null;

    if ($obsLat !== null && $obsLng !== null) {
        $distance = GeoUtils::distance($lat, $lng, $obsLat, $obsLng);
        if ($distance <= $radius) {
            $spatialObs[] = $obs;
        }
    }
}

// Area estimation
$areaHa = (pi() * pow($radius, 2)) / 10000;
$areaKm2 = $areaHa / 100;

// Gather BIS metrics (handles Shannon Index and Red List fetching internally)
$bisData = BiodiversityScorer::calculate($spatialObs, ['area_ha' => $areaHa]);

// --- 3. Extract Specific TNFD Metrics (Evaluate & Assess) ---
$redListSpecies = $bisData['breakdown']['conservation_value']['matches'] ?? [];
$redListDensity = ($areaKm2 > 0) ? count($redListSpecies) / $areaKm2 : 0;

$totalSpecies = $bisData['species_count'];
$shannonEvenness = 0;
if ($totalSpecies > 1) {
    // J' = H' / ln(S)
    $shannonEvenness = $bisData['shannon_index'] / log($totalSpecies);
}

// Extract time-series for Yo-Y trends
$currentYear = (int)date('Y');
$obsByYear = [];
foreach ($spatialObs as $obs) {
    $date = $obs['observed_at'] ?? $obs['date'] ?? null;
    if ($date) {
        $y = (int)substr($date, 0, 4);
        $obsByYear[$y] = ($obsByYear[$y] ?? 0) + 1;
    }
}
$obsThisYear = $obsByYear[$currentYear] ?? 0;
$obsLastYear = $obsByYear[$currentYear - 1] ?? 0;

// --- 4. LEAP Framework Output Structure ---
$response = [
    'success' => true,
    'meta' => [
        'generated_at' => date('c'),
        'api_tier' => $gateInfo['tier'],
        'organization' => $gateInfo['org'],
        'framework' => 'TNFD LEAP v1.0',
    ],
    'leap_report' => [
        // L: Locate the interface with nature
        'locate' => [
            'center_coordinates' => ['lat' => $lat, 'lng' => $lng],
            'radius_meters' => $radius,
            'estimated_area_ha' => round($areaHa, 2),
            'estimated_area_km2' => round($areaKm2, 2),
            'biome_context' => 'Terrestrial/Freshwater', // To be expanded with BiomeManager
        ],

        // E: Evaluate dependencies and impacts
        'evaluate' => [
            'total_observations' => count($spatialObs),
            'total_species_detected' => $totalSpecies,
            'taxonomic_groups_detected' => $bisData['breakdown']['taxonomic_coverage']['groups'] ?? [],
            'biodiversity_integrity_score' => $bisData['total_score'],
            'shannon_diversity_index' => $bisData['shannon_index'],
            'species_evenness_index' => round($shannonEvenness, 3), // J'
        ],

        // A: Assess material risks and opportunities
        'assess' => [
            'threatened_species_count' => count($redListSpecies),
            'threatened_species_list' => $redListSpecies,
            'threatened_species_density_per_km2' => round($redListDensity, 3),
            'data_confidence_score' => $bisData['breakdown']['data_confidence']['score'] ?? 0,
            'monitoring_trend' => [
                'observations_this_year' => $obsThisYear,
                'observations_last_year' => $obsLastYear,
                'yoy_growth_percent' => ($obsLastYear > 0) ? round((($obsThisYear - $obsLastYear) / $obsLastYear) * 100, 1) : null
            ]
        ],

        // P: Prepare to respond and report
        'prepare' => [
            'recommended_actions' => [
                'Maintain localized monitoring focus to improve Data Confidence Score.',
                'Cross-reference threatened species list with planned operational footprints.',
            ]
        ]
    ]
];

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_PRETTY_PRINT);
