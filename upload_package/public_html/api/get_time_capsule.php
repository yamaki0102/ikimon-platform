<?php

/**
 * get_time_capsule.php — Time Capsule API ("Echo from Last Year")
 *
 * Returns observations from the same date range one year ago.
 * "去年の今頃、こんな生き物に出会っていたよ。"
 *
 * GET params:
 *   - user_id (str): optional, defaults to current user
 *   - range  (int): days around today to search, default 7
 *
 * Response: JSON with past observations (echoes)
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=3600'); // 1 hour cache

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';

Auth::init();

$userId = $_GET['user_id'] ?? (Auth::user()['id'] ?? '');
$range = min(max((int)($_GET['range'] ?? 7), 1), 30);

if (!$userId) {
    echo json_encode(['error' => 'user_id required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Calculate last year's date range
$lastYearStart = date('Y-m-d', strtotime("-1 year -{$range} days"));
$lastYearEnd = date('Y-m-d', strtotime("-1 year +{$range} days"));

$allObs = DataStore::fetchAll('observations');

$echoes = [];

foreach ($allObs as $obs) {
    if (($obs['user_id'] ?? '') !== $userId) continue;

    $obsDate = substr($obs['observed_at'] ?? $obs['created_at'] ?? '', 0, 10);
    if ($obsDate < $lastYearStart || $obsDate > $lastYearEnd) continue;

    $echoes[] = [
        'id'      => $obs['id'],
        'date'    => $obsDate,
        'species' => $obs['taxon']['name'] ?? null,
        'photo'   => $obs['photos'][0] ?? null,
        'status'  => $obs['status'] ?? 'Needs ID',
        'location_hint' => $obs['location_name'] ?? '',
    ];
}

// Sort by date
usort($echoes, fn($a, $b) => strcmp($a['date'], $b['date']));

// Generate narrative
$narrative = '';
$echoCount = count($echoes);
if ($echoCount > 0) {
    $speciesList = array_unique(array_filter(array_map(fn($e) => $e['species'], $echoes)));
    if (count($speciesList) > 0) {
        $narrative = '去年の今頃、' . implode('、', array_slice($speciesList, 0, 3)) . ' に出会っていたよ。';
    } else {
        $narrative = '去年の今頃も、名前のわからない生き物との出会いがあったんだ。';
    }
} else {
    $narrative = '去年の今頃の記録はまだないみたい。今年から始まる物語だね。';
}

echo json_encode([
    'echoes'    => $echoes,
    'narrative' => $narrative,
    'meta'      => [
        'user_id'    => $userId,
        'range_days' => $range,
        'last_year'  => ['start' => $lastYearStart, 'end' => $lastYearEnd],
        'count'      => $echoCount,
        'cached'     => date('c'),
    ],
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
