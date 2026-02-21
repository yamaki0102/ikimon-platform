<?php

/**
 * get_journey_map.php — Personal Journey Map API
 *
 * Returns a user's observation journey as a geographic narrative.
 * Designed for profile page visualization — shows exploration paths,
 * first discoveries, and geographic spread over time.
 *
 * GET params:
 *   - user_id (str): optional, defaults to logged-in user
 *
 * Response JSON:
 *   - journey: array of journey milestones (chronological)
 *   - summary: overall exploration statistics
 *   - timeline: monthly activity summary
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/GeoUtils.php';

Auth::init();

$userId = $_GET['user_id'] ?? (Auth::isLoggedIn() ? Auth::user()['id'] : '');

if (!$userId) {
    echo json_encode(['error' => 'user_id is required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Cache for 30 minutes
$cacheKey = 'journey_map_' . md5($userId);
$cacheFile = DATA_DIR . '/cache/' . $cacheKey . '.json';
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 1800) {
    echo file_get_contents($cacheFile);
    exit;
}

$allObs = DataStore::fetchAll('observations');
$userObs = array_filter($allObs, fn($o) => ($o['user_id'] ?? '') === $userId);
usort($userObs, fn($a, $b) => strtotime($a['observed_at'] ?? '1970-01-01') - strtotime($b['observed_at'] ?? '1970-01-01'));

if (empty($userObs)) {
    $result = [
        'journey'  => [],
        'summary'  => ['total' => 0, 'species' => 0, 'span_days' => 0, 'regions' => 0],
        'timeline' => [],
    ];
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Build journey milestones
$journey = [];
$speciesSeen = [];
$regions = [];
$monthlyData = [];
$firstObs = null;
$lastObs = null;

foreach ($userObs as $obs) {
    $date = $obs['observed_at'] ?? '';
    $lat = $obs['latitude'] ?? null;
    $lng = $obs['longitude'] ?? null;
    $taxon = $obs['taxon']['name'] ?? null;
    $photo = $obs['photos'][0] ?? null;
    $month = date('Y-m', strtotime($date));

    if (!$firstObs) $firstObs = $date;
    $lastObs = $date;

    // Monthly summary
    if (!isset($monthlyData[$month])) {
        $monthlyData[$month] = ['month' => $month, 'count' => 0, 'species' => []];
    }
    $monthlyData[$month]['count']++;
    if ($taxon) $monthlyData[$month]['species'][$taxon] = true;

    // Region tracking (rounded to ~5km grid)
    if ($lat && $lng) {
        $regionKey = round($lat, 1) . ',' . round($lng, 1);
        $regions[$regionKey] = true;
    }

    // First discovery milestones
    $isNewSpecies = false;
    if ($taxon && !isset($speciesSeen[$taxon])) {
        $speciesSeen[$taxon] = true;
        $isNewSpecies = true;
    }

    // Milestone events
    $totalSoFar = count($journey) + 1;
    $milestone = null;
    if ($totalSoFar === 1) {
        $milestone = ['type' => 'first_record', 'label' => '最初の記録', 'emoji' => '🌱'];
    } elseif ($totalSoFar === 10) {
        $milestone = ['type' => 'tenth', 'label' => '10件達成', 'emoji' => '🌿'];
    } elseif ($totalSoFar === 50) {
        $milestone = ['type' => 'fiftieth', 'label' => '50件達成', 'emoji' => '🌳'];
    } elseif ($totalSoFar === 100) {
        $milestone = ['type' => 'hundredth', 'label' => '100件達成', 'emoji' => '🏔️'];
    } elseif (count($speciesSeen) === 10 && $isNewSpecies) {
        $milestone = ['type' => 'ten_species', 'label' => '10種発見', 'emoji' => '🔬'];
    } elseif (count($speciesSeen) === 50 && $isNewSpecies) {
        $milestone = ['type' => 'fifty_species', 'label' => '50種発見', 'emoji' => '🧬'];
    }

    $entry = [
        'id'          => $obs['id'] ?? '',
        'date'        => $date,
        'taxon'       => $taxon,
        'new_species' => $isNewSpecies,
        'photo'       => $photo,
        'milestone'   => $milestone,
    ];

    if ($lat && $lng) {
        // Round for privacy
        $entry['lat'] = round($lat, 2);
        $entry['lng'] = round($lng, 2);
    }

    $journey[] = $entry;
}

// Build timeline from monthly data
$timeline = array_values(array_map(function ($m) {
    return [
        'month'   => $m['month'],
        'count'   => $m['count'],
        'species' => count($m['species']),
    ];
}, $monthlyData));

// Summary
$spanDays = $firstObs && $lastObs ?
    (int)((strtotime($lastObs) - strtotime($firstObs)) / 86400) : 0;

$summary = [
    'total'     => count($userObs),
    'species'   => count($speciesSeen),
    'span_days' => $spanDays,
    'regions'   => count($regions),
    'first_date' => $firstObs,
    'last_date'  => $lastObs,
];

$result = [
    'journey'  => array_slice($journey, 0, 200), // Cap at 200 entries
    'summary'  => $summary,
    'timeline' => $timeline,
];

// Cache
$cacheDir = DATA_DIR . '/cache';
if (!is_dir($cacheDir)) mkdir($cacheDir, 0777, true);
file_put_contents($cacheFile, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG));

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
