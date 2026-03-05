<?php

/**
 * get_fog_data.php — Fog of War API
 *
 * Returns fog-of-war grid data: which cells have been "explored" 
 * (have observation records) and which remain "fogged".
 *
 * GET params:
 *   - bounds (str) : "sw_lat,sw_lng,ne_lat,ne_lng" viewport bounds
 *   - grid_m (int) : grid cell size in meters, default 1000
 *   - user_id (str): optional, show personal fog for specific user
 *
 * Response: JSON with explored cells and coverage stats
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=600'); // 10-min cache

require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/GeoUtils.php';
require_once __DIR__ . '/../../libs/Auth.php';

Auth::init();

$gridM = min(max((int)($_GET['grid_m'] ?? 1000), 500), 5000);
$userId = $_GET['user_id'] ?? null;

// Parse viewport bounds
$bounds = $_GET['bounds'] ?? '';
$boundsParts = array_map('floatval', explode(',', $bounds));

if (count($boundsParts) !== 4) {
    echo json_encode([
        'error' => 'bounds parameter required: sw_lat,sw_lng,ne_lat,ne_lng',
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

[$swLat, $swLng, $neLat, $neLng] = $boundsParts;

// Fetch all observations
$allObs = DataStore::fetchAll('observations');

// Build set of explored cell IDs
$exploredCells = [];
$cellCounts = [];

foreach ($allObs as $obs) {
    $lat = (float)($obs['latitude'] ?? $obs['location']['lat'] ?? 0);
    $lng = (float)($obs['longitude'] ?? $obs['location']['lng'] ?? 0);

    if ($lat === 0.0 && $lng === 0.0) continue;

    // If user filter is set, only count their observations
    if ($userId && ($obs['user_id'] ?? '') !== $userId) continue;

    // Check if within viewport (with margin)
    $margin = 0.05; // ~5km margin
    if ($lat < $swLat - $margin || $lat > $neLat + $margin) continue;
    if ($lng < $swLng - $margin || $lng > $neLng + $margin) continue;

    // Get cell ID using anonymized grid
    $cellId = GeoUtils::getGridCellId($lat, $lng, $gridM);
    $exploredCells[$cellId] = true;
    $cellCounts[$cellId] = ($cellCounts[$cellId] ?? 0) + 1;
}

// Generate grid cells within viewport
$cells = [];
$gridDegLat = $gridM / 111320;
$gridDegLng = $gridM / (111320 * cos(deg2rad(($swLat + $neLat) / 2)));

for ($lat = $swLat; $lat <= $neLat; $lat += $gridDegLat) {
    for ($lng = $swLng; $lng <= $neLng; $lng += $gridDegLng) {
        $cellCenter = GeoUtils::roundToGrid($lat, $lng, $gridM);
        $cellId = GeoUtils::getGridCellId($lat, $lng, $gridM);

        $explored = isset($exploredCells[$cellId]);
        $count = $cellCounts[$cellId] ?? 0;

        $cells[] = [
            'id'       => $cellId,
            'lat'      => $cellCenter['lat'],
            'lng'      => $cellCenter['lng'],
            'explored' => $explored,
            'count'    => $count,
            'level'    => getExplorationLevel($count),
        ];
    }
}

// Coverage stats
$totalCells = count($cells);
$exploredCount = count(array_filter($cells, fn($c) => $c['explored']));
$coveragePercent = $totalCells > 0 ? round(($exploredCount / $totalCells) * 100, 1) : 0;

echo json_encode([
    'cells' => $cells,
    'stats' => [
        'total_cells'      => $totalCells,
        'explored_cells'   => $exploredCount,
        'coverage_percent' => $coveragePercent,
        'grid_m'           => $gridM,
    ],
    'meta' => [
        'cached' => date('c'),
        'bounds' => compact('swLat', 'swLng', 'neLat', 'neLng'),
    ]
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);

/**
 * Get exploration level based on observation count
 */
function getExplorationLevel(int $count): int
{
    if ($count === 0) return 0;   // Fogged
    if ($count <= 2) return 1;    // Barely explored
    if ($count <= 5) return 2;    // Partially explored
    if ($count <= 10) return 3;   // Well explored
    return 4;                     // Fully mapped
}
