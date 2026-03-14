<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/EventManager.php';
require_once __DIR__ . '/../../libs/GeoUtils.php';
require_once __DIR__ . '/../../libs/CorporatePlanGate.php';
require_once __DIR__ . '/../../libs/SiteManager.php';

function event_range(array $event): array
{
    $eventDate = $event['event_date'] ?? date('Y-m-d');
    $startTime = $event['start_time'] ?? '09:00';
    $endTime = $event['end_time'] ?? '12:00';

    $start = new DateTime("{$eventDate} {$startTime}");
    $end = new DateTime("{$eventDate} {$endTime}");
    $start->modify('-30 minutes');
    $end->modify('+30 minutes');

    return [$start, $end];
}

function event_observation_candidates(DateTime $start, DateTime $end): array
{
    $months = [];
    $cursor = (clone $start)->modify('first day of this month')->setTime(0, 0);
    $last = (clone $end)->modify('first day of this month')->setTime(0, 0);

    while ($cursor <= $last) {
        $months[] = $cursor->format('Y-m');
        $cursor->modify('+1 month');
    }

    $candidates = [];
    $seen = [];
    foreach ($months as $month) {
        foreach (DataStore::get('observations/' . $month, 60) as $obs) {
            $obsId = $obs['id'] ?? null;
            if ($obsId && isset($seen[$obsId])) {
                continue;
            }
            if ($obsId) {
                $seen[$obsId] = true;
            }
            $candidates[] = $obs;
        }
    }

    if (!empty($candidates)) {
        return $candidates;
    }

    return DataStore::getLatest('observations', 2000);
}

function event_matches_observation(array $event, array $obs, DateTime $rangeStart, DateTime $rangeEnd): bool
{
    $obsTime = $obs['observed_at'] ?? $obs['created_at'] ?? '';
    if ($obsTime === '') {
        return false;
    }

    try {
        $obsDateTime = new DateTime($obsTime);
    } catch (Throwable $e) {
        return false;
    }

    if ($obsDateTime < $rangeStart || $obsDateTime > $rangeEnd) {
        return false;
    }

    $eventCode = trim((string)($event['event_code'] ?? ''));
    if ($eventCode !== '' && ($obs['event_tag'] ?? '') === $eventCode) {
        return true;
    }

    $linkedIds = $event['linked_observations'] ?? [];
    if (in_array($obs['id'] ?? '', $linkedIds, true)) {
        return true;
    }

    $siteId = $event['location']['site_id'] ?? ($event['site_id'] ?? '');
    if ($siteId !== '') {
        $obsSiteId = $obs['site_id'] ?? '';
        if ($obsSiteId === $siteId) {
            return true;
        }
        $lat = (float)($obs['lat'] ?? 0);
        $lng = (float)($obs['lng'] ?? 0);
        if ($lat && $lng && SiteManager::isPointInSite($lat, $lng, $siteId)) {
            return true;
        }
        return false;
    }

    $evtLat = (float)($event['location']['lat'] ?? 0);
    $evtLng = (float)($event['location']['lng'] ?? 0);
    $radiusM = (int)($event['location']['radius_m'] ?? 500);
    $obsLat = (float)($obs['lat'] ?? 0);
    $obsLng = (float)($obs['lng'] ?? 0);

    if (!$evtLat || !$evtLng || !$obsLat || !$obsLng) {
        return false;
    }

    return GeoUtils::distance($evtLat, $evtLng, $obsLat, $obsLng) <= $radiusM;
}

function observation_species(array $obs): array
{
    $taxon = $obs['taxon'] ?? [];
    $name = $taxon['name'] ?? ($obs['identifications'][0]['taxon_name'] ?? ($obs['species_name'] ?? ''));
    $key = $taxon['key'] ?? ($obs['identifications'][0]['taxon_key'] ?? $name);

    return [
        'name' => trim((string)$name),
        'key' => trim((string)$key),
    ];
}

$eventId = trim((string)($_GET['event_id'] ?? ''));
if ($eventId === '') {
    echo json_encode(['success' => false, 'message' => 'event_id が必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$event = EventManager::get($eventId);
if (!$event) {
    echo json_encode(['success' => false, 'message' => 'イベントが見つかりません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$corporation = CorporatePlanGate::resolveCorporationForEvent($event);
$canRevealSpeciesDetails = CorporatePlanGate::canRevealSpeciesDetails($corporation);

[$rangeStart, $rangeEnd] = event_range($event);
$participantMap = [];
foreach (($event['participants'] ?? []) as $participant) {
    if (is_array($participant)) {
        $participantId = (string)($participant['user_id'] ?? '');
        if ($participantId === '') {
            continue;
        }
        $participantMap[$participantId] = [
            'user_id' => $participantId,
            'user_name' => $participant['user_name'] ?? (str_starts_with($participantId, 'guest_') ? 'ゲスト' : '参加者'),
            'avatar' => $participant['avatar'] ?? null,
        ];
        continue;
    }

    $participantId = (string)$participant;
    if ($participantId !== '') {
        $participantMap[$participantId] = [
            'user_id' => $participantId,
            'user_name' => str_starts_with($participantId, 'guest_') ? 'ゲスト' : '参加者',
            'avatar' => null,
        ];
    }
}

$matchedObservations = [];
$topSpeciesMap = [];
$topPhotos = [];
$leaderboardMap = [];
$totalSpeciesSet = [];

foreach (event_observation_candidates($rangeStart, $rangeEnd) as $obs) {
    if (!event_matches_observation($event, $obs, $rangeStart, $rangeEnd)) {
        continue;
    }

    $obsUserId = (string)($obs['user_id'] ?? '');
    if (!empty($participantMap) && $obsUserId !== '' && !isset($participantMap[$obsUserId])) {
        continue;
    }

    $matchedObservations[] = $obs;
    $species = observation_species($obs);
    if ($species['name'] !== '') {
        $topSpeciesMap[$species['name']] = ($topSpeciesMap[$species['name']] ?? 0) + 1;
        $totalSpeciesSet[$species['key'] ?: $species['name']] = true;
    }

    if ($obsUserId === '') {
        continue;
    }

    if (!isset($leaderboardMap[$obsUserId])) {
        $participant = $participantMap[$obsUserId] ?? [];
        $leaderboardMap[$obsUserId] = [
            'user_id' => $obsUserId,
            'user_name' => $participant['user_name'] ?? ($obs['user_name'] ?? (str_starts_with($obsUserId, 'guest_') ? 'ゲスト' : '参加者')),
            'avatar' => $participant['avatar'] ?? ($obs['user_avatar'] ?? null),
            'observation_count' => 0,
            'species_keys' => [],
            'latest_observation' => '',
        ];
    }

    $leaderboardMap[$obsUserId]['observation_count']++;
    if ($species['name'] !== '') {
        $leaderboardMap[$obsUserId]['species_keys'][$species['key'] ?: $species['name']] = true;
    }
    $obsObservedAt = $obs['observed_at'] ?? $obs['created_at'] ?? '';
    if ($obsObservedAt > $leaderboardMap[$obsUserId]['latest_observation']) {
        $leaderboardMap[$obsUserId]['latest_observation'] = $obsObservedAt;
    }

    $photo = $obs['photos'][0] ?? null;
    if ($photo) {
        $counts = DataStore::getCounts('observations', $obs['id'] ?? '');
        $topPhotos[] = [
            'id' => $obs['id'] ?? '',
            'url' => $photo,
            'likes' => (int)($counts['likes'] ?? 0),
            'observed_at' => $obsObservedAt,
            'taxon_name' => $canRevealSpeciesDetails ? $species['name'] : '',
        ];
    }
}

foreach ($participantMap as $participantId => $participant) {
    if (!isset($leaderboardMap[$participantId])) {
        $leaderboardMap[$participantId] = [
            'user_id' => $participantId,
            'user_name' => $participant['user_name'] ?? (str_starts_with($participantId, 'guest_') ? 'ゲスト' : '参加者'),
            'avatar' => $participant['avatar'] ?? null,
            'observation_count' => 0,
            'species_keys' => [],
            'latest_observation' => '',
        ];
    }
}

$leaderboard = array_values(array_map(function (array $entry): array {
    $entry['species_count'] = count($entry['species_keys']);
    unset($entry['species_keys']);
    return $entry;
}, $leaderboardMap));

usort($leaderboard, function (array $a, array $b): int {
    $byObservation = $b['observation_count'] <=> $a['observation_count'];
    if ($byObservation !== 0) {
        return $byObservation;
    }

    $bySpecies = $b['species_count'] <=> $a['species_count'];
    if ($bySpecies !== 0) {
        return $bySpecies;
    }

    return strcmp($b['latest_observation'], $a['latest_observation']);
});

arsort($topSpeciesMap);
usort($topPhotos, function (array $a, array $b): int {
    $byLikes = $b['likes'] <=> $a['likes'];
    if ($byLikes !== 0) {
        return $byLikes;
    }
    return strcmp($b['observed_at'], $a['observed_at']);
});

$eventDays = max(1, (int)$rangeStart->diff($rangeEnd)->format('%a') + 1);

echo json_encode([
    'success' => true,
    'leaderboard' => array_values($leaderboard),
    'event_stats' => [
        'total_observations' => count($matchedObservations),
        'total_species' => count($totalSpeciesSet),
        'total_participants' => max(count($participantMap), count($leaderboard)),
        'event_days' => $eventDays,
        'species_detail_available' => $canRevealSpeciesDetails,
        'top_species' => $canRevealSpeciesDetails ? array_map(
            fn(string $name, int $count): array => ['name' => $name, 'count' => $count],
            array_slice(array_keys($topSpeciesMap), 0, 5),
            array_slice(array_values($topSpeciesMap), 0, 5)
        ) : [],
    ],
    'top_photos' => array_slice($topPhotos, 0, 6),
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
