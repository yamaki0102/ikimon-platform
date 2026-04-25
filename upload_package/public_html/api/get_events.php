<?php

/**
 * get_events.php — 観察会V2 一覧 API
 *
 * GET params:
 *   - site_id (str): optional, filter by site
 *   - status (str): optional, 'all' for all, default: upcoming+open
 *   - upcoming (bool): optional, show only future events (default: true)
 *   - lat (float): optional, for distance sorting
 *   - lng (float): optional, for distance sorting
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/EventManager.php';
require_once __DIR__ . '/../../libs/GeoUtils.php';

$siteId = $_GET['site_id'] ?? '';
$statusFilter = $_GET['status'] ?? 'open';
$upcoming = ($_GET['upcoming'] ?? 'true') !== 'false';
$today = date('Y-m-d');
$userLat = (float)($_GET['lat'] ?? 0);
$userLng = (float)($_GET['lng'] ?? 0);

$filters = [
    'site_id' => $siteId,
    'status' => ($statusFilter === 'all') ? '' : $statusFilter,
    // 'upcoming' logic is handled by 'status' in EventManager partially, 
    // but EventManager supports 'upcoming', 'past', 'live'.
    // If 'status' params is 'open' (default), it conceptually maps to 'upcoming' + 'live'?
    // The original logic was: Status Filter AND Upcoming Filter.
    // Let's rely on EventManager's listItems but maybe we need raw list if logic is complex.
    // EventManager::listItems() supports 'status' => 'upcoming' etc.
    // Let's use EventManager::listItems without status filter first, then filter manually if needed for backward compat?
    // Actually, EventManager::listItems is powerful enough.
];

// If status is 'open', we treat it as no specific status filter to get everything, then filter?
// The original code filtered by status field in JSON.
// AND filtered by date if $upcoming is true.
// EventManager::listItems($filters) 

// Let's pass null for status to get all, then filter manually to match EXACT logic of previous version
// OR update EventManager to support exactly what we need.
// Previous logic: 
// 1. $event['status'] == $statusFilter (unless 'all') -> 'open' by default
// 2. $event['event_date'] < $today (if $upcoming)

// Let's just use EventManager::listItems() to get raw list for now if filters are simple,
// but to preserve exact logic, let's fetch 'all' mostly.
$events = EventManager::listItems(['limit' => 100]);
$filtered = [];

foreach ($events as $event) {
    // Site filter
    if ($siteId) {
        $evtSiteId = $event['location']['site_id'] ?? $event['site_id'] ?? '';
        if ($evtSiteId !== $siteId) continue;
    }

    // Status filter
    if ($statusFilter !== 'all' && ($event['status'] ?? 'open') !== $statusFilter) continue;

    // Upcoming filter
    if ($upcoming && ($event['event_date'] ?? '') < $today) continue;

    // Add computed fields
    $obsCount = count($event['linked_observations'] ?? []);
    // Backward compat
    $participantCount = count($event['participants'] ?? []);

    $event['observation_count'] = $obsCount;
    $event['participant_count'] = $participantCount;

    // Distance from user
    if ($userLat && $userLng) {
        $evtLat = (float)($event['location']['lat'] ?? $event['lat'] ?? 0);
        $evtLng = (float)($event['location']['lng'] ?? $event['lng'] ?? 0);
        $event['distance_km'] = ($evtLat && $evtLng)
            ? round(GeoUtils::distance($userLat, $userLng, $evtLat, $evtLng) / 1000, 1)
            : null;
    }

    $filtered[] = $event;
}

// Sort by event_date ascending (upcoming first), then by distance
usort($filtered, function ($a, $b) {
    $dateComp = strcmp($a['event_date'] ?? '', $b['event_date'] ?? '');
    if ($dateComp !== 0) return $dateComp;
    return ($a['distance_km'] ?? 9999) <=> ($b['distance_km'] ?? 9999);
});

echo json_encode([
    'success' => true,
    'events'  => $filtered,
    'total'   => count($filtered),
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
