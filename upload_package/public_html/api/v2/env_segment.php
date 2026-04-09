<?php

/**
 * POST /api/v2/env_segment.php
 *
 * FieldScan v0.9.0 の SpatialSegmentBuilder が生成した環境セグメントを受信・保存する。
 *
 * Request:
 *   POST ?install_id=XXX
 *   Authorization: Bearer <token>
 *   {
 *     "session_id": "fs_...",
 *     "schema_version": "1.0",
 *     "app_version": "0.9.0",
 *     "segments": [
 *       {
 *         "segment_id": "seg_uuid",
 *         "start_lat": 35.123, "start_lng": 139.456,
 *         "end_lat": 35.124, "end_lng": 139.460,
 *         "start_timestamp": 1712345678000,
 *         "end_timestamp": 1712345708000,
 *         "distance_meters": 45.3,
 *         "signals": { "water_proximity": 0.72, ... },
 *         "segment_delta": 0.34,
 *         "observation_count": 4,
 *         "ai_version": "v0.9.0"
 *       }
 *     ]
 *   }
 *
 * Response:
 *   { "success": true, "data": { "stored": 3, "session_id": "fs_..." } }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/EnvSegmentStore.php';
require_once ROOT_DIR . '/libs/Auth.php';

// POST のみ
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('Method not allowed', 405);
}

// App token 認証
$installId = $_GET['install_id'] ?? '';
if (empty($installId)) {
    api_error('install_id required', 401);
}

// レート制限: 1分あたり10リクエスト
if (!api_rate_limit('env_segment_' . $installId, 10, 60)) {
    api_error('Rate limit exceeded', 429);
}

// リクエストボディ解析
$body = api_json_body();
if (empty($body)) {
    api_error('Empty request body', 400);
}

$sessionId = $body['session_id'] ?? '';
$schemaVersion = $body['schema_version'] ?? '';
$segments = $body['segments'] ?? [];

// バリデーション
if (empty($sessionId)) {
    api_error('session_id required', 400);
}
if ($schemaVersion !== '1.0') {
    api_error('Unsupported schema_version (expected: 1.0)', 400);
}
if (!is_array($segments)) {
    api_error('segments must be an array', 400);
}
if (count($segments) > 100) {
    api_error('Maximum 100 segments per request', 400);
}
if (empty($segments)) {
    api_success(['stored' => 0, 'session_id' => $sessionId]);
}

// セグメントバリデーション + サニタイズ
$validSegments = [];
$requiredFields = ['segment_id', 'start_lat', 'start_lng', 'end_lat', 'end_lng',
                   'start_timestamp', 'end_timestamp', 'signals'];

foreach ($segments as $i => $seg) {
    // 必須フィールドチェック
    foreach ($requiredFields as $field) {
        if (!isset($seg[$field])) {
            api_error("segments[$i]: missing required field '$field'", 400);
        }
    }

    // 座標の妥当性
    if (!is_numeric($seg['start_lat']) || abs($seg['start_lat']) > 90) {
        api_error("segments[$i]: invalid start_lat", 400);
    }
    if (!is_numeric($seg['start_lng']) || abs($seg['start_lng']) > 180) {
        api_error("segments[$i]: invalid start_lng", 400);
    }

    // signals の構造チェック
    $signals = $seg['signals'];
    if (!is_array($signals)) {
        api_error("segments[$i]: signals must be an object", 400);
    }

    $signalKeys = ['water_proximity', 'canopy_cover', 'vegetation_density',
                   'anthropogenic_pressure', 'edge_structure', 'disturbance_level',
                   'acoustic_complexity'];
    foreach ($signalKeys as $key) {
        if (isset($signals[$key]) && (!is_numeric($signals[$key]) || $signals[$key] < 0 || $signals[$key] > 1)) {
            api_error("segments[$i]: signals.$key must be 0-1", 400);
        }
    }

    // サニタイズ済みセグメント
    $validSegments[] = [
        'segment_id'        => htmlspecialchars((string)$seg['segment_id'], ENT_QUOTES, 'UTF-8'),
        'session_id'        => htmlspecialchars($sessionId, ENT_QUOTES, 'UTF-8'),
        'install_id'        => htmlspecialchars($installId, ENT_QUOTES, 'UTF-8'),
        'start_lat'         => (float)$seg['start_lat'],
        'start_lng'         => (float)$seg['start_lng'],
        'end_lat'           => (float)$seg['end_lat'],
        'end_lng'           => (float)$seg['end_lng'],
        'start_timestamp'   => (int)$seg['start_timestamp'],
        'end_timestamp'     => (int)$seg['end_timestamp'],
        'distance_meters'   => (float)($seg['distance_meters'] ?? 0),
        'signals'           => $signals,
        'segment_delta'     => (float)($seg['segment_delta'] ?? 0),
        'observation_count' => (int)($seg['observation_count'] ?? 0),
        'ai_version'        => htmlspecialchars((string)($seg['ai_version'] ?? 'unknown'), ENT_QUOTES, 'UTF-8'),
        'schema_version'    => '1.0',
        'received_at'       => date('c'),
    ];
}

// 保存
$stored = EnvSegmentStore::saveBatch($validSegments, $sessionId);

api_success([
    'stored'     => $stored,
    'session_id' => $sessionId,
]);
