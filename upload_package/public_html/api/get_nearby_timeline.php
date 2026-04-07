<?php
/**
 * Nearby Timeline API — 特定座標の周辺の観察記録を時系列で返す
 * GET /api/get_nearby_timeline.php?lat=34.97&lng=138.38&radius=1000&species=xxx
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/GeoUtils.php';

$lat = isset($_GET['lat']) ? (float)$_GET['lat'] : null;
$lng = isset($_GET['lng']) ? (float)$_GET['lng'] : null;
$radius = min((int)($_GET['radius'] ?? 1000), 10000); // max 10km
$species = trim($_GET['species'] ?? '');
$limit = min((int)($_GET['limit'] ?? 50), 200);

if (!$lat || !$lng) {
    echo json_encode(['success' => false, 'error' => 'lat and lng required']);
    exit;
}

$observations = DataStore::fetchAll('observations');

$nearby = [];
foreach ($observations as $obs) {
    if (empty($obs['lat']) || empty($obs['lng'])) continue;
    if (!empty($obs['photo_missing'])) continue;

    $obsLat = (float)$obs['lat'];
    $obsLng = (float)$obs['lng'];
    $distance = GeoUtils::distance($lat, $lng, $obsLat, $obsLng);

    if ($distance > $radius) continue;

    if ($species) {
        $obsSpecies = $obs['taxon']['name'] ?? $obs['species_name'] ?? '';
        if (mb_stripos($obsSpecies, $species) === false) continue;
    }

    $nearby[] = [
        'id' => $obs['id'],
        'species_name' => $obs['taxon']['name'] ?? $obs['species_name'] ?? '',
        'photo' => $obs['photos'][0] ?? null,
        'observed_at' => $obs['observed_at'] ?? '',
        'user_name' => $obs['user_name'] ?? substr($obs['user_id'] ?? '', 0, 4),
        'distance_m' => round($distance),
        'municipality' => $obs['municipality'] ?? '',
        'note' => mb_substr($obs['note'] ?? '', 0, 80),
    ];
}

usort($nearby, function ($a, $b) {
    return strcmp($b['observed_at'], $a['observed_at']);
});

$nearby = array_slice($nearby, 0, $limit);

// Monthly summary
$monthlySummary = [];
foreach ($nearby as $item) {
    $month = substr($item['observed_at'], 0, 7);
    if (!isset($monthlySummary[$month])) {
        $monthlySummary[$month] = ['count' => 0, 'species' => []];
    }
    $monthlySummary[$month]['count']++;
    if ($item['species_name']) {
        $monthlySummary[$month]['species'][] = $item['species_name'];
    }
}
foreach ($monthlySummary as &$m) {
    $m['species'] = array_values(array_unique($m['species']));
    $m['species_count'] = count($m['species']);
}
unset($m);

echo json_encode([
    'success' => true,
    'observations' => $nearby,
    'total' => count($nearby),
    'monthly_summary' => $monthlySummary,
    'center' => ['lat' => $lat, 'lng' => $lng],
    'radius_m' => $radius,
], JSON_UNESCAPED_UNICODE);
