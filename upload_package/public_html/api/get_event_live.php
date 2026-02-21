<?php

/**
 * get_event_live.php — 観察会V2 リアルタイムダッシュボード API
 * Modified for Event Code Support
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/GeoUtils.php';
require_once __DIR__ . '/../../libs/EventManager.php';

$eventId = $_GET['id'] ?? '';
if (!$eventId) {
    echo json_encode(['success' => false, 'message' => 'イベントIDが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$event = EventManager::get($eventId);
if (!$event) {
    echo json_encode(['success' => false, 'message' => 'イベントが見つかりません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Determine time range for auto-collection (30min buffer)
$eventDate = $event['event_date'] ?? date('Y-m-d');
$startTime = $event['start_time'] ?? '09:00';
$endTime = $event['end_time'] ?? '12:00';
$bufferMin = 30;

$rangeStart = (new DateTime("{$eventDate} {$startTime}"))->modify("-{$bufferMin} minutes");
$rangeEnd = (new DateTime("{$eventDate} {$endTime}"))->modify("+{$bufferMin} minutes");

$evtLat = (float)($event['location']['lat'] ?? 0);
$evtLng = (float)($event['location']['lng'] ?? 0);
$radiusM = (int)($event['location']['radius_m'] ?? 500);

$eventCode = $event['event_code'] ?? '';

// --- Observation Collection Strategy ---
// 1. Manually Linked (ids in event data)
// 2. Tag Linked (via event_code matching event_tag)
// 3. Spatial/Temporal Auto-Link (legacy behavior)

$linkedIds = $event['linked_observations'] ?? [];
$finalObservations = [];
$candidates = [];

// Fetch observations from potential sources
// Optimized: Load today's partition
$dateKey = str_replace('-', '', $eventDate); // YYYYMMDD
$partitionFile = "observations/{$dateKey}";
$dayObservations = DataStore::get($partitionFile);

if (!$dayObservations || !is_array($dayObservations)) {
    // Fallback: fetch recent/all if partition missing
    $candidates = DataStore::getLatest('observations', 2000);
} else {
    $candidates = $dayObservations;
}

// Processing
$speciesSet = [];
$contributors = [];
$touchedObsIds = [];

// Helper to add obs
$addObs = function ($obs, $source) use (&$finalObservations, &$speciesSet, &$contributors, &$touchedObsIds) {
    if (!isset($obs['id'])) return;
    $id = $obs['id'];

    if (isset($touchedObsIds[$id])) return;
    $touchedObsIds[$id] = true;

    // Build summary
    $identifications = $obs['identifications'] ?? [];
    $taxonName = $obs['taxon']['name'] ?? ($identifications[0]['taxon_name'] ?? '不明');
    $scientificName = $obs['taxon']['scientific_name'] ?? '';
    $photos = $obs['photos'] ?? [];
    $photo = !empty($photos) ? $photos[0] : null;

    // Contributor
    $uid = $obs['user_id'] ?? '';
    if ($uid) {
        if (!isset($contributors[$uid])) {
            $contributors[$uid] = [
                'name'   => $obs['user_name'] ?? 'Guest',
                'avatar' => $obs['user_avatar'] ?? null,
                'count'  => 0,
            ];
        }
        $contributors[$uid]['count']++;
    }

    // Species
    if ($taxonName && $taxonName !== '不明') {
        $speciesSet[$taxonName] = $scientificName;
    }

    $finalObservations[] = [
        'id'              => $id,
        'taxon_name'      => $taxonName,
        'scientific_name' => $scientificName,
        'photo'           => $photo,
        'user_name'       => $obs['user_name'] ?? 'Guest',
        'user_avatar'     => $obs['user_avatar'] ?? null,
        'observed_at'     => $obs['observed_at'] ?? $obs['created_at'] ?? '',
        'source'          => $source, // 'manual', 'tag', 'auto'
    ];
};

foreach ($candidates as $obs) {
    if (!isset($obs['id'])) continue;
    $obsId = $obs['id'];
    $obsTag = $obs['event_tag'] ?? '';

    // 1. Manual Link check
    if (in_array($obsId, $linkedIds)) {
        $addObs($obs, 'manual');
        continue;
    }

    // 2. Tag Link check
    if ($eventCode && $obsTag === $eventCode) {
        $addObs($obs, 'tag');
        continue;
    }

    // 3. Auto Link check (Spatial/Temporal)
    // Only if date matches (optimization)
    $obsTime = $obs['observed_at'] ?? $obs['created_at'] ?? '';
    if (!$obsTime) continue;

    // Date string check first for speed
    if (strpos($obsTime, $eventDate) !== 0) continue;

    $obsDateTime = new DateTime($obsTime);
    if ($obsDateTime >= $rangeStart && $obsDateTime <= $rangeEnd) {
        // Distance Check
        $obsLat = (float)($obs['lat'] ?? 0);
        $obsLng = (float)($obs['lng'] ?? 0);
        if ($obsLat && $obsLng && $evtLat && $evtLng) {
            $distM = GeoUtils::distance($evtLat, $evtLng, $obsLat, $obsLng);
            if ($distM <= $radiusM) {
                $addObs($obs, 'auto');
            }
        }
    }
}

// Sort: Newest First
usort($finalObservations, fn($a, $b) => strcmp($b['observed_at'], $a['observed_at']));

// Target Species Progress
$targetSpecies = $event['target_species'] ?? [];
$targetProgress = [];
foreach ($targetSpecies as $sp) {
    $targetProgress[] = [
        'name'  => $sp,
        'found' => isset($speciesSet[$sp]),
    ];
}

// Live Status
$now = new DateTime();
$isLive = ($now >= $rangeStart && $now <= $rangeEnd);
$isPast = ($now > $rangeEnd);

echo json_encode([
    'success' => true,
    'event'   => [
        'id'          => $event['id'],
        'title'       => $event['title'],
        'memo'        => $event['memo'] ?? '',
        'event_code'  => $eventCode,
        'event_date'  => $eventDate,
        'start_time'  => $startTime,
        'end_time'    => $endTime,
        'location'    => $event['location'],
        'organizer'   => $event['organizer_name'],
        'status'      => $isLive ? 'live' : ($isPast ? 'ended' : 'upcoming'),
    ],
    'stats'   => [
        'species_count'     => count($speciesSet),
        'observation_count' => count($finalObservations),
        'contributor_count' => count($contributors),
    ],
    'species_list'    => array_keys($speciesSet),
    'contributors'    => array_values($contributors),
    'observations'    => array_slice($finalObservations, 0, 50),
    'target_progress' => $targetProgress,
    'is_live'         => $isLive,
    'is_past'         => $isPast,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
