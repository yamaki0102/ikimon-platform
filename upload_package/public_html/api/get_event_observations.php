<?php
/**
 * Event Observations API — 観察会に紐づいた投稿を一覧で返す
 * GET /api/get_event_observations.php?event_id=xxx
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';

$eventId = trim($_GET['event_id'] ?? '');
if (!$eventId) {
    echo json_encode(['success' => false, 'error' => 'event_id required']);
    exit;
}

$observations = DataStore::fetchAll('observations');

$eventObs = array_filter($observations, function ($obs) use ($eventId) {
    return ($obs['event_id'] ?? '') === $eventId && empty($obs['photo_missing']);
});

usort($eventObs, function ($a, $b) {
    return strcmp($a['observed_at'] ?? '', $b['observed_at'] ?? '');
});

$participants = [];
$species = [];
$photos = [];

foreach ($eventObs as $obs) {
    $userId = $obs['user_id'] ?? '';
    $userName = $obs['user_name'] ?? substr($userId, 0, 4);
    if (!isset($participants[$userId])) {
        $participants[$userId] = [
            'user_id' => $userId,
            'user_name' => $userName,
            'avatar' => $obs['user_avatar'] ?? '/assets/img/default-avatar.svg',
            'count' => 0,
            'species' => [],
        ];
    }
    $participants[$userId]['count']++;

    $speciesName = $obs['taxon']['name'] ?? $obs['species_name'] ?? '';
    if ($speciesName) {
        $species[] = $speciesName;
        $participants[$userId]['species'][] = $speciesName;
    }

    if (!empty($obs['photos'][0])) {
        $photos[] = $obs['photos'][0];
    }
}

foreach ($participants as &$p) {
    $p['species'] = array_values(array_unique($p['species']));
    $p['species_count'] = count($p['species']);
}
unset($p);

$uniqueSpecies = array_values(array_unique($species));

$compactObs = array_map(function ($obs) {
    return [
        'id' => $obs['id'],
        'species_name' => $obs['taxon']['name'] ?? $obs['species_name'] ?? '',
        'photo' => $obs['photos'][0] ?? null,
        'observed_at' => $obs['observed_at'] ?? '',
        'user_name' => $obs['user_name'] ?? '',
        'user_id' => $obs['user_id'] ?? '',
        'municipality' => $obs['municipality'] ?? '',
    ];
}, array_values($eventObs));

echo json_encode([
    'success' => true,
    'event_id' => $eventId,
    'observations' => $compactObs,
    'total_observations' => count($compactObs),
    'total_species' => count($uniqueSpecies),
    'species_list' => $uniqueSpecies,
    'participants' => array_values($participants),
    'total_participants' => count($participants),
    'photos' => array_slice($photos, 0, 12),
], JSON_UNESCAPED_UNICODE);
