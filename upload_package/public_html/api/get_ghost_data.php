<?php

/**
 * get_ghost_data.php — Ghost Presence API
 *
 * Returns anonymized "presence" hints for nearby recent activity.
 * "近くに気配があります" — someone observed nearby recently.
 *
 * GET params:
 *   - lat (float) : user's current latitude
 *   - lng (float) : user's current longitude
 *   - radius (int): search radius in meters, default 5000, max 10000
 *
 * Response: JSON with ghost presence data
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/GeoUtils.php';
require_once __DIR__ . '/../../libs/PrivacyFilter.php';

$lat = (float)($_GET['lat'] ?? 0);
$lng = (float)($_GET['lng'] ?? 0);
$radius = min(max((int)($_GET['radius'] ?? 5000), 1000), 10000);

if ($lat === 0.0 && $lng === 0.0) {
    echo json_encode(['error' => 'lat/lng required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Lookback: 48 hours
$cutoff = date('Y-m-d\TH:i:s', strtotime('-48 hours'));

$allObs = DataStore::fetchAll('observations');

$ghosts = [];

foreach ($allObs as $obs) {
    $obsDate = $obs['observed_at'] ?? $obs['created_at'] ?? '';
    if ($obsDate < $cutoff) continue;

    $obsLat = (float)($obs['latitude'] ?? $obs['location']['lat'] ?? 0);
    $obsLng = (float)($obs['longitude'] ?? $obs['location']['lng'] ?? 0);
    if ($obsLat === 0.0 && $obsLng === 0.0) continue;

    // Calculate distance
    $dist = GeoUtils::distance($lat, $lng, $obsLat, $obsLng);
    if ($dist > $radius) continue;

    // Apply privacy: only show grid-rounded position + vague time
    $rounded = GeoUtils::roundToGrid($obsLat, $obsLng, 1000); // 1km grid

    // Vague time: "今日" / "昨日" / "最近"
    $hoursAgo = (time() - strtotime($obsDate)) / 3600;
    if ($hoursAgo < 6) {
        $vagueTime = 'now';      // さっき
    } elseif ($hoursAgo < 24) {
        $vagueTime = 'today';    // 今日
    } else {
        $vagueTime = 'recent';   // 最近
    }

    // Determine taxon category (vague: order level only)
    $taxonHint = '';
    $lineage = $obs['taxon']['lineage'] ?? $obs['lineage'] ?? null;
    if ($lineage) {
        // Show order or class, never species
        $taxonHint = $lineage['order'] ?? $lineage['class'] ?? '';
    }

    // Has photo?
    $hasPhoto = !empty($obs['photos']);

    $cellId = GeoUtils::getGridCellId($obsLat, $obsLng, 1000);

    // Group by cell to avoid revealing individual observations
    if (!isset($ghosts[$cellId])) {
        $ghosts[$cellId] = [
            'cell_id'  => $cellId,
            'lat'      => $rounded['lat'],
            'lng'      => $rounded['lng'],
            'count'    => 0,
            'latest'   => $vagueTime,
            'hints'    => [],
            'distance' => round($dist),
        ];
    }

    $ghosts[$cellId]['count']++;
    if ($taxonHint && !in_array($taxonHint, $ghosts[$cellId]['hints'])) {
        $ghosts[$cellId]['hints'][] = $taxonHint;
    }
    // Update to most recent vague time
    if ($vagueTime === 'now') {
        $ghosts[$cellId]['latest'] = 'now';
    } elseif ($vagueTime === 'today' && $ghosts[$cellId]['latest'] !== 'now') {
        $ghosts[$cellId]['latest'] = 'today';
    }
}

// Sort by distance
$ghostList = array_values($ghosts);
usort($ghostList, fn($a, $b) => $a['distance'] <=> $b['distance']);

// Limit to closest 10
$ghostList = array_slice($ghostList, 0, 10);

echo json_encode([
    'ghosts' => $ghostList,
    'meta'   => [
        'radius'  => $radius,
        'count'   => count($ghostList),
        'cached'  => date('c'),
    ]
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
