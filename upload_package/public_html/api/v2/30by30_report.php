<?php

/**
 * Phase C2: 30by30 / OECM Environmental Report API (v2)
 *
 * Generate reports formatted for the Japanese Ministry of the Environment's
 * 30by30 / Nature Symbiosis Site (自然共生サイト) applications.
 * 
 * Features:
 * - Aggregates full species list (種名リスト) for a given area.
 * - Flags "重要種" (Important Species) via RedListManager.
 * - Flags "要対策外来種" (Alien species requiring countermeasures).
 * - Implements protective coordinate obscuring for Important Species.
 *
 * Requires 'enterprise' tier API Key.
 *
 * Usage:
 * /api/v2/30by30_report.php?lat=34.710&lng=137.726&radius=5000&years=5
 */

require_once __DIR__ . '/../../../config/config.php';
require_once __DIR__ . '/../../../libs/DataStore.php';
require_once __DIR__ . '/../../../libs/GeoUtils.php';
require_once __DIR__ . '/../../../libs/RedListManager.php';
require_once __DIR__ . '/../../../libs/ApiGate.php';

header('Content-Type: application/json; charset=utf-8');

// --- 0. Authorization ---
$gateInfo = ApiGate::check('enterprise');

// --- 1. Input Validation ---
$lat = isset($_GET['lat']) ? (float)$_GET['lat'] : null;
$lng = isset($_GET['lng']) ? (float)$_GET['lng'] : null;
$radius = isset($_GET['radius']) ? (int)$_GET['radius'] : 1000;
$years = isset($_GET['years']) ? (int)$_GET['years'] : 5;

$MAX_RADIUS = 50000; // 50km
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

// Target date range calculation
$currentYear = (int)date('Y');
$minYear = $currentYear - $years;

// MVP Alien Species List (TODO: Move to AlienSpeciesManager and JSON datastore in Phase 15)
$alienSpeciesList = [
    'アライグマ',
    'ウシガエル',
    'オオクチバス',
    'ブルーギル',
    'アメリカザリガニ',
    'アカミミガメ',
    'マングース',
    'カミツキガメ',
    'クビアカツヤカミキリ',
    'ヒアリ',
    'セアカゴケグモ',
    'アルゼンチンアリ',
    'オオキンケイギク',
    'アレチウリ'
];

// --- 2. Data Filtering ---
$allObs = DataStore::fetchAll('observations');
$spatialObs = [];
$speciesMap = []; // Summarized species data

$redListManager = new RedListManager();

foreach ($allObs as $obs) {
    // Quality check (require location and organism)
    if (empty($obs['quality_flags']['has_location']) || empty($obs['quality_flags']['is_organism'])) {
        continue;
    }

    $date = $obs['observed_at'] ?? $obs['date'] ?? null;
    $obsYear = $date ? (int)substr($date, 0, 4) : 0;

    // Filter by recent years requested (1-5 years typical for 30by30)
    if ($obsYear > 0 && $obsYear < $minYear) {
        continue;
    }

    $obsLat = $obs['location']['lat'] ?? $obs['lat'] ?? null;
    $obsLng = $obs['location']['lng'] ?? $obs['lng'] ?? null;

    if ($obsLat !== null && $obsLng !== null) {
        $distance = GeoUtils::distance($lat, $lng, $obsLat, $obsLng);
        if ($distance <= $radius) {

            $taxonId = $obs['taxon']['id'] ?? null;
            $taxonName = $obs['taxon']['name'] ?? $obs['taxon_name_ja'] ?? 'Unknown';
            if ($taxonName === 'Unknown') continue;

            $key = $taxonName; // Group by Japanese name for the Ministry report

            if (!isset($speciesMap[$key])) {
                $speciesMap[$key] = [
                    'species_name' => $taxonName,
                    'taxon_id' => $taxonId,
                    'observation_count' => 0,
                    'first_seen' => $date,
                    'last_seen' => $date,
                    'is_important_species' => false,
                    'red_list_status' => null,
                    'is_alien_species' => in_array($taxonName, $alienSpeciesList)
                ];

                // Check Red List status
                $rlMatch = $redListManager->lookupTaxon($taxonId, $taxonName, 'shizuoka');
                if ($rlMatch) {
                    $speciesMap[$key]['is_important_species'] = true;
                    $speciesMap[$key]['red_list_status'] = $rlMatch;
                }
            }

            // Update aggregates
            $speciesMap[$key]['observation_count']++;
            if ($date && (!$speciesMap[$key]['first_seen'] || $date < $speciesMap[$key]['first_seen'])) {
                $speciesMap[$key]['first_seen'] = $date;
            }
            if ($date && (!$speciesMap[$key]['last_seen'] || $date > $speciesMap[$key]['last_seen'])) {
                $speciesMap[$key]['last_seen'] = $date;
            }

            // Handle observation for the raw export list
            $exportObs = [
                'id' => $obs['id'] ?? uniqid(),
                'species_name' => $taxonName,
                'observed_at' => $date,
                'quality' => $obs['data_quality'] ?? 'unknown',
            ];

            // Protective Coordinate Obscuring (Secret)
            if ($speciesMap[$key]['is_important_species']) {
                // Round coordinates to ~11km precision (1 decimal place) or hide entirely
                // 30by30 requires evidence of existence inside the polygon, precise point is restricted
                $exportObs['lat'] = round($obsLat, 2); // ~1.1km resolution
                $exportObs['lng'] = round($obsLng, 2);
                $exportObs['location_obscured'] = true;
            } else {
                $exportObs['lat'] = $obsLat;
                $exportObs['lng'] = $obsLng;
                $exportObs['location_obscured'] = false;
            }

            $spatialObs[] = $exportObs;
        }
    }
}

// Convert Map to indexed array and sort by observation count descending
$speciesList = array_values($speciesMap);
usort($speciesList, fn($a, $b) => $b['observation_count'] <=> $a['observation_count']);

// Summary metrics
$importantCount = count(array_filter($speciesList, fn($s) => $s['is_important_species']));
$alienCount = count(array_filter($speciesList, fn($s) => $s['is_alien_species']));

// --- 3. Output Output Structure ---
$response = [
    'success' => true,
    'meta' => [
        'generated_at' => date('c'),
        'api_tier' => $gateInfo['tier'],
        'organization' => $gateInfo['org'],
        'report_format' => '30by30_nature_symbiosis_site',
        'target_years' => $years
    ],
    'area_info' => [
        'center_coordinates' => ['lat' => $lat, 'lng' => $lng],
        'radius_meters' => $radius,
        'estimated_area_ha' => round((pi() * pow($radius, 2)) / 10000, 2),
    ],
    'summary' => [
        'total_species' => count($speciesList),
        'important_species_count' => $importantCount,
        'alien_species_count' => $alienCount,
        'total_observations' => count($spatialObs)
    ],
    'species_list' => $speciesList,
    'observations' => $spatialObs // Includes obscrured coordinates for important species
];

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_PRETTY_PRINT);
