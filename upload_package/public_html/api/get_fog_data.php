<?php

/**
 * get_fog_data.php — Exploration Map Fog API (v2)
 *
 * Returns fog-of-war grid data combining both observation records AND
 * GPS track data. Supports fine-grained grids (50m+) and period filtering.
 *
 * GET params:
 *   - bounds  (str) : "sw_lat,sw_lng,ne_lat,ne_lng" viewport bounds
 *   - grid_m  (int) : grid cell size in meters (50–5000, default 100)
 *   - period  (str) : today|week|month|year|all (default: all)
 *   - user_id (str) : optional, defaults to logged-in user
 *   - layers  (str) : comma-separated: fog,trails,observations (default: all)
 *
 * Response: JSON with cells, trails, observations, and stats
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300'); // 5-min cache

require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/GeoUtils.php';
require_once __DIR__ . '/../../libs/Auth.php';

Auth::init();

// ── Parse Parameters ──
$gridM   = min(max((int)($_GET['grid_m'] ?? 100), 50), 5000);
$period  = $_GET['period'] ?? 'all';
$userId  = $_GET['user_id'] ?? null;
$layersParam = $_GET['layers'] ?? 'fog,trails,observations';
$layers  = array_flip(explode(',', $layersParam));

// Default to logged-in user
if (!$userId) {
    $currentUser = Auth::user();
    $userId = $currentUser['id'] ?? null;
}

if (!$userId) {
    echo json_encode(['error' => 'user_id required or must be logged in'], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Parse Viewport Bounds ──
$bounds = $_GET['bounds'] ?? '';
$boundsParts = array_map('floatval', explode(',', $bounds));

if (count($boundsParts) !== 4) {
    echo json_encode([
        'error' => 'bounds parameter required: sw_lat,sw_lng,ne_lat,ne_lng',
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

[$swLat, $swLng, $neLat, $neLng] = $boundsParts;

// ── Period Filter (date range) ──
$periodStart = null;
$now = time();
switch ($period) {
    case 'today':
        $periodStart = strtotime('today midnight');
        break;
    case 'week':
        $periodStart = strtotime('-7 days midnight');
        break;
    case 'month':
        $periodStart = strtotime('-30 days midnight');
        break;
    case 'year':
        $periodStart = strtotime('-365 days midnight');
        break;
    case 'all':
    default:
        $periodStart = null;
        break;
}

// ── Collect explored cells from TRACKS ──
$exploredCells   = []; // cellId => true
$cellObsCounts   = []; // cellId => observation count
$cellTrackCounts = []; // cellId => track point count
$cellTiers       = []; // cellId => speed_tier ('walk','bike','vehicle','fast')
$trails          = [];
$observations    = [];

$margin = max($gridM / 111320 * 2, 0.005); // adaptive margin

// --- 1. Read GPS Track Data ---
$trackDir = DATA_DIR . '/tracks/' . $userId;
if (is_dir($trackDir)) {
    $files = glob($trackDir . '/*.json');
    foreach ($files as $file) {
        $track = json_decode(file_get_contents($file), true);
        if (!$track || empty($track['points'])) continue;

        // Period filter: check track date
        $trackDate = strtotime($track['started_at'] ?? $track['updated_at'] ?? '');
        if ($periodStart && $trackDate && $trackDate < $periodStart) continue;

        $pts = $track['points'];
        $trailCoords = [];
        $prevPt = null;

        for ($i = 0; $i < count($pts); $i++) {
            $lat = (float)$pts[$i]['lat'];
            $lng = (float)$pts[$i]['lng'];

            if ($lat === 0.0 && $lng === 0.0) continue;

            // Calculate speed from previous valid point
            $speedKmh = 0;
            if ($prevPt) {
                $dist = GeoUtils::distance($prevPt['lat'], $prevPt['lng'], $lat, $lng);
                $ts = (float)($pts[$i]['timestamp'] ?? 0);
                $prevTs = (float)($prevPt['timestamp'] ?? 0);
                $timeDiff = ($ts - $prevTs) / 1000; // ms -> sec
                $speedKmh = ($timeDiff > 0) ? ($dist / $timeDiff) * 3.6 : 0;
            }
            $tier = speedToTier($speedKmh);

            // Collect trail coordinates (within bounds + margin)
            if ($lat >= $swLat - $margin && $lat <= $neLat + $margin &&
                $lng >= $swLng - $margin && $lng <= $neLng + $margin) {
                $trailCoords[] = [$lng, $lat, $tier];
            }

            // Mark cell as explored with speed tier
            $cellId = getSimpleCellId($lat, $lng, $gridM);
            $exploredCells[$cellId] = true;
            $cellTrackCounts[$cellId] = ($cellTrackCounts[$cellId] ?? 0) + 1;

            // Keep slowest tier for each cell
            if (!isset($cellTiers[$cellId]) || tierPriority($tier) < tierPriority($cellTiers[$cellId])) {
                $cellTiers[$cellId] = $tier;
            }

            // Interpolate between consecutive points to fill gaps
            if ($prevPt) {
                interpolateCells($prevPt['lat'], $prevPt['lng'], $lat, $lng, $gridM, $exploredCells, $cellTrackCounts, $cellTiers, $tier);
            }

            $prevPt = ['lat' => $lat, 'lng' => $lng, 'timestamp' => ($pts[$i]['timestamp'] ?? 0)];
        }

        // Add to trails list
        if (!empty($trailCoords) && isset($layers['trails'])) {
            $simplified = simplifyCoords($trailCoords, 3);
            $coords = array_map(fn($p) => [$p[0], $p[1]], $simplified);
            $tiers  = array_map(fn($p) => $p[2] ?? 'walk', $simplified);
            $trails[] = [
                'session_id' => $track['session_id'],
                'date'       => substr($track['started_at'] ?? '', 0, 10),
                'coords'     => $coords,
                'tiers'      => $tiers,
                'distance_m' => (float)($track['total_distance_m'] ?? 0),
                'points'     => count($pts),
            ];
        }
    }
}

// --- 2. Read Observation Data ---
$allObs = DataStore::fetchAll('observations');
foreach ($allObs as $obs) {
    $lat = (float)($obs['latitude'] ?? $obs['location']['lat'] ?? 0);
    $lng = (float)($obs['longitude'] ?? $obs['location']['lng'] ?? 0);

    if ($lat === 0.0 && $lng === 0.0) continue;
    if ($userId && ($obs['user_id'] ?? '') !== $userId) continue;

    $createdAt = (string)($obs['created_at'] ?? '');
    $createdYear = $createdAt !== '' ? (int)substr($createdAt, 0, 4) : 0;
    if ($createdYear < 2026) continue;

    // Period filter
    $obsDate = strtotime($obs['observed_at'] ?? $obs['created_at'] ?? '');
    if ($periodStart && $obsDate && $obsDate < $periodStart) continue;

    // Mark cell — observations are always on foot
    $cellId = getSimpleCellId($lat, $lng, $gridM);
    $exploredCells[$cellId] = true;
    $cellObsCounts[$cellId] = ($cellObsCounts[$cellId] ?? 0) + 1;
    $cellTiers[$cellId] = 'walk'; // observation = physically present

    // Add to observations list (if within bounds)
    if (isset($layers['observations']) &&
        $lat >= $swLat - $margin && $lat <= $neLat + $margin &&
        $lng >= $swLng - $margin && $lng <= $neLng + $margin) {
        $observations[] = [
            'id'    => $obs['id'] ?? '',
            'lat'   => $lat,
            'lng'   => $lng,
            'name'  => $obs['species_name'] ?? $obs['common_name'] ?? '',
            'photo' => $obs['photo_url'] ?? $obs['photos'][0] ?? '',
            'date'  => substr($obs['observed_at'] ?? $obs['created_at'] ?? '', 0, 10),
        ];
    }
}

// --- 3. Build grid cells (only explored ones within viewport) ---
$cells = [];
if (isset($layers['fog'])) {
    foreach ($exploredCells as $cellId => $v) {
        // Decode cell center from ID
        $center = decodeCellCenter($cellId);
        if (!$center) continue;

        // Within viewport check
        $cLat = $center['lat'];
        $cLng = $center['lng'];
        $halfLat = ($gridM / 111320) / 2;
        $halfLng = ($gridM / (111320 * cos(deg2rad($cLat)))) / 2;

        if ($cLat + $halfLat < $swLat || $cLat - $halfLat > $neLat) continue;
        if ($cLng + $halfLng < $swLng || $cLng - $halfLng > $neLng) continue;

        $obsCount = $cellObsCounts[$cellId] ?? 0;
        $cells[] = [
            'lat'     => $cLat,
            'lng'     => $cLng,
            'has_obs' => $obsCount > 0,
            'count'   => $obsCount,
            'tier'    => $cellTiers[$cellId] ?? 'walk',
        ];
    }
}

// --- 4. Stats ---
$totalExploredCells = count($exploredCells);
$areaPerCell = ($gridM * $gridM); // m²

// Count cells by speed tier
$walkCells = 0;
$bikeCells = 0;
$vehicleCells = 0;
$fastCells = 0;
foreach ($cellTiers as $t) {
    match($t) {
        'walk' => $walkCells++,
        'bike' => $bikeCells++,
        'vehicle' => $vehicleCells++,
        'fast' => $fastCells++,
        default => $fastCells++,
    };
}
// Cells without tier data (observation-only without track) default to walk
$untaggedCells = $totalExploredCells - count($cellTiers);
$walkCells += $untaggedCells;

// Explored area = walk + bike cells only
$exploredAreaM2 = ($walkCells + $bikeCells) * $areaPerCell;

// Total distance from all tracks
$totalDistanceM = 0;
foreach ($trails as $t) {
    $totalDistanceM += $t['distance_m'];
}

$stats = [
    'explored_cells'    => $totalExploredCells,
    'explored_area_m2'  => $exploredAreaM2,
    'walk_cells'        => $walkCells,
    'bike_cells'        => $bikeCells,
    'vehicle_cells'     => $vehicleCells,
    'fast_cells'        => $fastCells,
    'observation_count' => count($observations),
    'total_distance_m'  => round($totalDistanceM),
    'grid_m'            => $gridM,
    'period'            => $period,
    'trail_count'       => count($trails),
];

echo json_encode([
    'cells'        => $cells,
    'trails'       => isset($layers['trails']) ? $trails : [],
    'observations' => isset($layers['observations']) ? $observations : [],
    'stats'        => $stats,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);


// =========================================================================
// Helper Functions
// =========================================================================

/**
 * Simple cell ID using rounded lat/lng as string key.
 * Faster than MD5 hash, and decodable back to center coordinates.
 */
function getSimpleCellId(float $lat, float $lng, int $gridM): string
{
    $latDeg = $gridM / 111320.0;
    $lngDeg = $gridM / (111320.0 * cos(deg2rad($lat)));

    $cellLat = floor($lat / $latDeg) * $latDeg + ($latDeg / 2);
    $cellLng = floor($lng / $lngDeg) * $lngDeg + ($lngDeg / 2);

    return sprintf("%.6f:%.6f", $cellLat, $cellLng);
}

/**
 * Decode cell center from simple cell ID.
 */
function decodeCellCenter(string $cellId): ?array
{
    $parts = explode(':', $cellId);
    if (count($parts) !== 2) return null;
    return ['lat' => (float)$parts[0], 'lng' => (float)$parts[1]];
}

/**
 * Interpolate cells between two points to prevent gaps.
 */
function interpolateCells(
    float $lat1, float $lng1,
    float $lat2, float $lng2,
    int $gridM,
    array &$explored,
    array &$trackCounts,
    array &$cellTiers = [],
    string $tier = 'walk'
): void {
    $dist = GeoUtils::distance($lat1, $lng1, $lat2, $lng2);
    $steps = (int)ceil($dist / ($gridM * 0.7)); // 70% of cell size for overlap

    if ($steps <= 1) return; // Points are in same or adjacent cell

    for ($s = 1; $s < $steps; $s++) {
        $t = $s / $steps;
        $iLat = $lat1 + ($lat2 - $lat1) * $t;
        $iLng = $lng1 + ($lng2 - $lng1) * $t;
        $cellId = getSimpleCellId($iLat, $iLng, $gridM);
        $explored[$cellId] = true;
        $trackCounts[$cellId] = ($trackCounts[$cellId] ?? 0) + 1;
        // Keep slowest tier
        if (!isset($cellTiers[$cellId]) || tierPriority($tier) < tierPriority($cellTiers[$cellId])) {
            $cellTiers[$cellId] = $tier;
        }
    }
}

/**
 * Determine speed tier from km/h.
 */
function speedToTier(float $speedKmh): string
{
    if ($speedKmh < 7) return 'walk';
    if ($speedKmh < 25) return 'bike';
    if ($speedKmh < 100) return 'vehicle';
    return 'fast';
}

/**
 * Priority for tier comparison (lower = slower = takes priority).
 */
function tierPriority(string $tier): int
{
    return match($tier) {
        'walk' => 0,
        'bike' => 1,
        'vehicle' => 2,
        'fast' => 3,
        default => 3,
    };
}

/**
 * Simplify coordinates array by keeping every Nth point.
 * Always keeps first and last point.
 */
function simplifyCoords(array $coords, int $keepEveryN): array
{
    if (count($coords) <= 20) return $coords;

    $result = [$coords[0]];
    for ($i = 1; $i < count($coords) - 1; $i++) {
        if ($i % $keepEveryN === 0) {
            $result[] = $coords[$i];
        }
    }
    $result[] = $coords[count($coords) - 1];
    return $result;
}
