<?php

/**
 * get_personal_report.php — Personal Report API (Wrapped-style)
 *
 * Generates a personalized "year in review" style report for a user.
 * Template × Data approach: predefined narrative blocks filled with real data.
 *
 * GET params:
 *   - user_id (str): optional, defaults to current user
 *   - year (int): optional, defaults to current year
 *
 * Response: JSON with report slides
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';

Auth::init();

$userId = $_GET['user_id'] ?? (Auth::user()['id'] ?? '');
$year = (int)($_GET['year'] ?? date('Y'));

if (!$userId) {
    echo json_encode(['error' => 'user_id required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$allObs = DataStore::fetchAll('observations');

// Filter to user's observations for the year
$yearStart = "$year-01-01";
$yearEnd = "$year-12-31T23:59:59";

$userObs = array_filter($allObs, function ($o) use ($userId, $yearStart, $yearEnd) {
    if (($o['user_id'] ?? '') !== $userId) return false;
    $date = $o['observed_at'] ?? $o['created_at'] ?? '';
    return $date >= $yearStart && $date <= $yearEnd;
});

$totalCount = count($userObs);

// Monthly breakdown
$monthlyData = array_fill(1, 12, 0);
foreach ($userObs as $obs) {
    $date = $obs['observed_at'] ?? $obs['created_at'] ?? '';
    $month = (int)date('n', strtotime($date));
    $monthlyData[$month]++;
}
$peakMonth = array_keys($monthlyData, max($monthlyData))[0];
$monthNames = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

// Species diversity
$speciesMap = [];
foreach ($userObs as $obs) {
    $name = $obs['taxon']['name'] ?? '';
    if ($name) {
        $speciesMap[$name] = ($speciesMap[$name] ?? 0) + 1;
    }
}
arsort($speciesMap);
$topSpecies = array_slice($speciesMap, 0, 5, true);
$uniqueSpeciesCount = count($speciesMap);

// First observation of the year
$first = null;
foreach ($userObs as $obs) {
    $date = $obs['observed_at'] ?? $obs['created_at'] ?? '';
    if (!$first || $date < ($first['observed_at'] ?? $first['created_at'] ?? '')) {
        $first = $obs;
    }
}

// Research Grade count
$rgCount = count(array_filter($userObs, fn($o) => ($o['status'] ?? '') === 'Research Grade'));

// Build Wrapped-style slides
$slides = [];

// Slide 1: Opening
$slides[] = [
    'type' => 'intro',
    'title' => "{$year}年の足あと",
    'subtitle' => '今年、どんな生き物と出会った？',
    'color' => '#059669',
];

// Slide 2: Total observations
$slides[] = [
    'type' => 'number',
    'title' => '記録した瞬間',
    'value' => $totalCount,
    'unit' => '件',
    'message' => $totalCount > 50
        ? 'すごい観察力！地域のエキスパートだね。'
        : ($totalCount > 10
            ? 'たくさんの出会いがあったね。'
            : '一つ一つの出会いが宝物。'),
    'color' => '#10b981',
];

// Slide 3: Peak month
if ($totalCount > 0) {
    $slides[] = [
        'type' => 'highlight',
        'title' => '最も活発だった月',
        'value' => $monthNames[$peakMonth],
        'detail' => $monthlyData[$peakMonth] . '件の記録',
        'monthly_data' => $monthlyData,
        'color' => '#f59e0b',
    ];
}

// Slide 4: Top species
if ($uniqueSpeciesCount > 0) {
    $slides[] = [
        'type' => 'ranking',
        'title' => 'よく出会った生き物',
        'items' => array_map(fn($name, $count) => [
            'name' => $name,
            'count' => $count,
        ], array_keys($topSpecies), array_values($topSpecies)),
        'total_species' => $uniqueSpeciesCount,
        'color' => '#8b5cf6',
    ];
}

// Slide 5: First observation
if ($first) {
    $slides[] = [
        'type' => 'memory',
        'title' => '今年最初の記録',
        'date' => substr($first['observed_at'] ?? $first['created_at'] ?? '', 0, 10),
        'species' => $first['taxon']['name'] ?? '名前を待っている記録',
        'photo' => $first['photos'][0] ?? null,
        'color' => '#06b6d4',
    ];
}

// Slide 6: Research Grade
if ($rgCount > 0) {
    $slides[] = [
        'type' => 'achievement',
        'title' => 'みんなの知恵で確定した記録',
        'value' => $rgCount,
        'unit' => '件',
        'message' => 'あなたの記録が科学データになった。',
        'color' => '#059669',
    ];
}

// Slide 7: Closing
$slides[] = [
    'type' => 'outro',
    'title' => 'これからも、一緒に。',
    'message' => "あなたの足あとが、この地域の生態地図を描いていく。",
    'color' => '#1e293b',
];

echo json_encode([
    'slides' => $slides,
    'meta' => [
        'user_id' => $userId,
        'year'    => $year,
        'generated_at' => date('c'),
    ],
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
