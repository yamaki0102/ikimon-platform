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

$userId = Auth::getUserId();
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

// 観察を保存
$savedCount = 0;
foreach ($result['observations'] as $obs) {
    // プライバシーフィルタ（保護種チェック）
    if (!empty($obs['taxon']['scientific_name']) && class_exists('PrivacyFilter')) {
        if (PrivacyFilter::isProtectedSpecies($obs['taxon']['scientific_name'])) {
            $obs['privacy_layer'] = PrivacyFilter::LAYER_PRIVATE;
        }
    }

    if (DataStore::append('observations', $obs)) {
        $savedCount++;
    }
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

api_success([
    'session_id' => $result['session_id'],
    'observations_created' => $savedCount,
    'summary' => $result['summary'],
], [
    'events_received' => count($events),
    'events_valid' => count($validEvents),
]);
