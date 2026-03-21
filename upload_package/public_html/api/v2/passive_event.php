<?php

/**
 * API v2: Passive Event Receiver
 *
 * ポケットモード/スキャンモードからのパッシブ検出イベントを受信する。
 * バッチ送信対応。端末側は Wi-Fi 接続時にまとめて送る。
 *
 * POST /api/v2/passive_event.php
 * Body: {
 *   "events": [
 *     {
 *       "type": "audio",           // audio | visual | sensor
 *       "taxon_name": "シジュウカラ",
 *       "scientific_name": "Parus minor",
 *       "confidence": 0.87,
 *       "lat": 35.6762,
 *       "lng": 139.6503,
 *       "timestamp": "2026-03-19T10:30:00+09:00",
 *       "model": "birdnet_lite_v2",
 *       "audio_snippet_hash": "a1b2c3..."  // 音声の場合
 *     }
 *   ],
 *   "session": {
 *     "duration_sec": 1800,
 *     "distance_m": 1200,
 *     "device": "Pixel 10 Pro",
 *     "app_version": "1.0.0",
 *     "route_polyline": "encoded_polyline..."
 *   }
 * }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/DataQuality.php';
require_once ROOT_DIR . '/libs/DataStageManager.php';
require_once ROOT_DIR . '/libs/PrivacyFilter.php';
require_once ROOT_DIR . '/libs/PassiveObservationEngine.php';
require_once ROOT_DIR . '/libs/CanonicalStore.php';

// 認証
Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Authentication required.', 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST method required.', 405);
}

// レート制限（パッシブは大量バッチなので緩め）
if (!api_rate_limit('passive_event', 10, 60)) {
    api_error('Rate limit exceeded. Max 10 batches per minute.', 429);
}

$user = Auth::user();
$userId = $user['id'] ?? null;
$userName = $user['name'] ?? 'Unknown';
$userAvatar = $user['avatar'] ?? null;
$body = api_json_body();

$events = $body['events'] ?? [];
$sessionMeta = $body['session'] ?? [];

if (empty($events)) {
    api_error('No events provided.', 400);
}

if (count($events) > 500) {
    api_error('Too many events. Max 500 per batch.', 400);
}

// イベントバリデーション
$validEvents = [];
foreach ($events as $i => $event) {
    if (empty($event['type']) || empty($event['taxon_name'])) continue;
    if (!in_array($event['type'], ['audio', 'visual', 'sensor'], true)) continue;

    $validEvents[] = [
        'type'               => $event['type'],
        'taxon_name'         => trim($event['taxon_name']),
        'scientific_name'    => trim($event['scientific_name'] ?? ''),
        'taxon_key'          => $event['taxon_key'] ?? null,
        'confidence'         => max(0.0, min(1.0, (float) ($event['confidence'] ?? 0))),
        'lat'                => isset($event['lat']) ? (float) $event['lat'] : null,
        'lng'                => isset($event['lng']) ? (float) $event['lng'] : null,
        'timestamp'          => $event['timestamp'] ?? date('c'),
        'model'              => $event['model'] ?? 'unknown',
        'audio_snippet_hash' => $event['audio_snippet_hash'] ?? null,
        'photo_ref'          => $event['photo_ref'] ?? null,
    ];
}

if (empty($validEvents)) {
    api_error('No valid events after validation.', 400);
}

// パッシブ観察エンジンで処理
$result = PassiveObservationEngine::processEventBatch($validEvents, $userId, $sessionMeta);

// 保存先を分離:
// - ウォーク（音声検出）→ DataStore（フィード表示） + Canonical Schema（デジタルツイン）
// - ライブスキャン → Canonical Schema のみ（デジタルツイン専用、フィードには出さない）
$scanMode = $sessionMeta['scan_mode'] ?? 'walk';
$isLiveScan = ($scanMode === 'live-scan');

// ─── Canonical Schema: 1セッション = 1 parent event ───
// Codex C0-1: 努力量データを正しくセッション単位で紐づける
$parentEventId = null;
$savedCount = 0;

try {
    // セッション全体の重心座標を計算
    $lats = array_filter(array_column($result['observations'], 'lat'));
    $lngs = array_filter(array_column($result['observations'], 'lng'));
    $centerLat = !empty($lats) ? array_sum($lats) / count($lats) : null;
    $centerLng = !empty($lngs) ? array_sum($lngs) / count($lngs) : null;

    // 努力量を構造化 JSON で保存
    $samplingEffort = [
        'duration_sec'  => (int) ($sessionMeta['duration_sec'] ?? 0),
        'distance_m'    => (float) ($sessionMeta['distance_m'] ?? 0),
        'route_polyline' => $sessionMeta['route_polyline'] ?? null,
    ];

    // セッション event を作成（parent）
    $parentEventId = CanonicalStore::createEvent([
        'event_date'              => date('c'),
        'decimal_latitude'        => $centerLat,
        'decimal_longitude'       => $centerLng,
        'sampling_protocol'       => $isLiveScan ? 'live-scan' : 'walk-audio',
        'sampling_effort'         => $samplingEffort,
        'capture_device'          => $sessionMeta['device'] ?? null,
        'recorded_by'             => $userId,
        'session_mode'            => $sessionMeta['scan_mode'] ?? $scanMode,
        'complete_checklist_flag' => (int) ($sessionMeta['complete_checklist'] ?? 0),
        'target_taxa_scope'       => $sessionMeta['target_taxa_scope'] ?? null,
    ]);
} catch (Exception $e) {
    error_log('[passive_event] Session event creation error: ' . $e->getMessage());
}

foreach ($result['observations'] as $obs) {
    // プライバシーフィルタ（保護種チェック）
    if (!empty($obs['taxon']['scientific_name']) && class_exists('PrivacyFilter')) {
        if (PrivacyFilter::isProtectedSpecies($obs['taxon']['scientific_name'])) {
            $obs['privacy_layer'] = PrivacyFilter::LAYER_PRIVATE;
        }
    }

    $obs['user_name'] = $userName;
    $obs['user_avatar'] = $userAvatar;
    $obs['observation_source'] = $scanMode;

    // ウォークの音声検出 → フィード用 DataStore にも保存
    if (!$isLiveScan) {
        DataStore::append('observations', $obs);
    }

    // 全モード → Canonical Schema（デジタルツインに蓄積）
    if ($parentEventId) {
        try {
            // 個別検出の child event（精密な位置・時刻を持つ）
            $childEventId = CanonicalStore::createEvent([
                'parent_event_id'  => $parentEventId,
                'event_date'       => $obs['observed_at'] ?? date('c'),
                'decimal_latitude' => $obs['lat'] ?? null,
                'decimal_longitude'=> $obs['lng'] ?? null,
                'sampling_protocol'=> $isLiveScan ? 'live-scan' : 'walk-audio',
                'recorded_by'      => $userId,
                'capture_device'   => $sessionMeta['device'] ?? null,
                'session_mode'     => $sessionMeta['scan_mode'] ?? $scanMode,
                'coordinate_uncertainty_m' => $obs['gps_accuracy'] ?? null,
            ]);

            CanonicalStore::createOccurrence([
                'event_id'            => $childEventId,
                'scientific_name'     => $obs['taxon']['scientific_name'] ?? null,
                'basis_of_record'     => 'MachineObservation',
                'evidence_tier'       => 1,
                'observation_source'  => $scanMode,
                'detection_confidence'=> $obs['detection_confidence'] ?? null,
                'detection_model'     => $obs['detection_model'] ?? null,
                'original_observation_id' => $obs['id'] ?? null,
                'occurrence_status'   => 'present',
            ]);
            $savedCount++;
        } catch (Exception $e) {
            error_log('[passive_event] Canonical occurrence error: ' . $e->getMessage());
        }
    }
}

// 検出ゼロでもセッション event は残す（不在データ = 努力したが見つからなかった記録）
if ($savedCount === 0 && $parentEventId) {
    error_log('[passive_event] Zero detections session recorded as absence data: ' . $parentEventId);
}

// セッションログを保存
$sessionLog = [
    'session_id' => $result['session_id'],
    'user_id' => $userId,
    'events_received' => count($events),
    'events_valid' => count($validEvents),
    'observations_created' => $savedCount,
    'summary' => $result['summary'],
    'session_meta' => $sessionMeta,
    'created_at' => date('c'),
];
DataStore::append('passive_sessions', $sessionLog);

// スキャンクエスト生成
$scanQuests = [];
if ($isLiveScan && !empty($result['summary']['species'])) {
    require_once ROOT_DIR . '/libs/QuestManager.php';
    $questSessionMeta = array_merge($sessionMeta, ['session_id' => $result['session_id']]);
    $scanQuests = QuestManager::generateFromScan($userId, $result['summary'], $questSessionMeta);
    QuestManager::saveScanQuests($userId, $scanQuests);
}

api_success([
    'session_id' => $result['session_id'],
    'observations_created' => $savedCount,
    'summary' => $result['summary'],
    'scan_quests' => $scanQuests,
], [
    'events_received' => count($events),
    'events_valid' => count($validEvents),
]);
