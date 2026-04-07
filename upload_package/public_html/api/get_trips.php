<?php
/**
 * Trip Grouping API — 同日・同エリアの観察をトリップとしてグルーピング
 * GET /api/get_trips.php?user_id=xxx&limit=10
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/GeoUtils.php';

Auth::init();
$currentUser = Auth::user();

$userId = $_GET['user_id'] ?? ($currentUser['id'] ?? '');
$limit = min((int)($_GET['limit'] ?? 10), 50);

if (!$userId) {
    echo json_encode(['success' => false, 'error' => 'user_id required']);
    exit;
}

$observations = DataStore::fetchAll('observations');

$userObs = array_filter($observations, function ($obs) use ($userId) {
    return ($obs['user_id'] ?? '') === $userId && empty($obs['photo_missing']);
});

usort($userObs, function ($a, $b) {
    return strcmp($b['observed_at'] ?? '', $a['observed_at'] ?? '');
});

// Group by date + area (within 5km radius)
$trips = [];
$assigned = [];

foreach ($userObs as $obs) {
    $obsId = $obs['id'] ?? '';
    if (isset($assigned[$obsId])) continue;

    $date = substr($obs['observed_at'] ?? $obs['created_at'] ?? '', 0, 10);
    $lat = (float)($obs['lat'] ?? 0);
    $lng = (float)($obs['lng'] ?? 0);

    $trip = [
        'date' => $date,
        'center_lat' => $lat,
        'center_lng' => $lng,
        'observations' => [$obs],
        'species' => [],
        'municipality' => $obs['municipality'] ?? '',
    ];
    $assigned[$obsId] = true;

    $speciesName = $obs['taxon']['name'] ?? $obs['species_name'] ?? '';
    if ($speciesName) $trip['species'][] = $speciesName;

    // Find other observations on same date within 5km
    foreach ($userObs as $other) {
        $otherId = $other['id'] ?? '';
        if (isset($assigned[$otherId])) continue;

        $otherDate = substr($other['observed_at'] ?? $other['created_at'] ?? '', 0, 10);
        if ($otherDate !== $date) continue;

        $otherLat = (float)($other['lat'] ?? 0);
        $otherLng = (float)($other['lng'] ?? 0);

        if ($lat && $lng && $otherLat && $otherLng) {
            $distance = GeoUtils::distance($lat, $lng, $otherLat, $otherLng);
            if ($distance > 5000) continue;
        }

        $trip['observations'][] = $other;
        $assigned[$otherId] = true;

        $otherSpecies = $other['taxon']['name'] ?? $other['species_name'] ?? '';
        if ($otherSpecies) $trip['species'][] = $otherSpecies;
    }

    $trip['species'] = array_values(array_unique($trip['species']));
    $trip['count'] = count($trip['observations']);
    $trip['photos'] = array_slice(
        array_filter(array_map(fn($o) => ($o['photos'][0] ?? null), $trip['observations'])),
        0, 4
    );

    // Compact observations for response
    $trip['observations'] = array_map(function ($o) {
        return [
            'id' => $o['id'],
            'species_name' => $o['taxon']['name'] ?? $o['species_name'] ?? '',
            'photo' => $o['photos'][0] ?? null,
            'observed_at' => $o['observed_at'] ?? '',
        ];
    }, $trip['observations']);

    $trips[] = $trip;
}

// Only return multi-observation trips or all if limit allows
$trips = array_slice($trips, 0, $limit);

echo json_encode([
    'success' => true,
    'trips' => $trips,
    'total' => count($trips),
], JSON_UNESCAPED_UNICODE);
