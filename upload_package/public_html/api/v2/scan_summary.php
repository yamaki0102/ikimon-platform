<?php

/**
 * API v2: Scan Summary — ライブスキャンの活動サマリーをフィードに投稿
 *
 * 個別の検出ではなく、セッション全体を1件の「活動記録」としてフィードに保存。
 * 「📡 30分のライブスキャンで12種検出」のような投稿になる。
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Unauthorized', 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST required', 405);
}

$user = Auth::user();
$body = api_json_body();

$durationMin = (int) ($body['duration_min'] ?? 0);
$speciesCount = (int) ($body['species_count'] ?? 0);
$totalDet = (int) ($body['total_detections'] ?? 0);
$audioDet = (int) ($body['audio_detections'] ?? 0);
$visualDet = (int) ($body['visual_detections'] ?? 0);
$gpsPoints = (int) ($body['gps_points'] ?? 0);
$speciesList = $body['species'] ?? [];
$environment = $body['environment'] ?? null;
$lat = $body['lat'] ?? null;
$lng = $body['lng'] ?? null;

// 0分 or 0検出のスキャンは保存しない
if ($durationMin < 1 && $speciesCount === 0) {
    api_success(['saved' => false, 'reason' => 'Empty scan']);
}

// 検出された種名のリスト（上位5種）
$topSpecies = array_slice($speciesList, 0, 5);
$speciesNames = array_map(function($s) { return $s['name'] ?? ''; }, $topSpecies);

// フィード用の観察レコードとして保存
$summary = [
    'id' => 'scan_' . bin2hex(random_bytes(8)),
    'user_id' => $user['id'],
    'user_name' => $user['name'] ?? '',
    'user_avatar' => $user['avatar'] ?? null,
    'observation_source' => 'live-scan-summary',
    'observed_at' => date('Y-m-d H:i:s'),
    'lat' => $lat,
    'lng' => $lng,
    'photos' => [],  // 写真なし
    'taxon' => [
        'name' => $speciesCount > 0
            ? $speciesCount . '種を検出（' . implode('、', array_slice($speciesNames, 0, 3)) . '…）'
            : 'ライブスキャン完了',
        'scientific_name' => '',
    ],
    'species_name' => $speciesCount . '種検出',
    'detection_type' => 'live-scan-summary',
    'scan_summary' => [
        'duration_min' => $durationMin,
        'species_count' => $speciesCount,
        'total_detections' => $totalDet,
        'audio_detections' => $audioDet,
        'visual_detections' => $visualDet,
        'gps_points' => $gpsPoints,
        'top_species' => $topSpecies,
        'environment' => $environment,
    ],
    'data_quality' => 'C',
    'created_at' => date('Y-m-d H:i:s'),
];

DataStore::append('observations', $summary);

api_success(['saved' => true, 'id' => $summary['id']]);
