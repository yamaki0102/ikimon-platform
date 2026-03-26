<?php

/**
 * API v2: Live Detections — リアルタイムマップ用
 *
 * GET /api/v2/live_detections.php?lat=35.6&lng=139.7&radius=10
 *   - lat: 中心緯度 (任意)
 *   - lng: 中心経度 (任意)
 *   - radius: 検索半径 km (デフォルト 10)
 *
 * レスポンス:
 *   { success: true, data: { detections: [...], count: N } }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/CanonicalStore.php';

require_once ROOT_DIR . '/libs/Auth.php';

// ===== POST: 個別検出をリアルタイムマップに追加 =====
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    Auth::init();
    if (!Auth::isLoggedIn()) {
        api_error('Authentication required', 401);
    }
    if (!api_rate_limit('live_det_post', 60, 60)) {
        api_error('Rate limit exceeded', 429);
    }

    $body = api_json_body();
    $user = Auth::user();

    $detId = CanonicalStore::addLiveDetection([
        'user_id'              => $user['id'],
        'lat'                  => (float) ($body['lat'] ?? 0),
        'lng'                  => (float) ($body['lng'] ?? 0),
        'scientific_name'      => $body['scientific_name'] ?? null,
        'common_name'          => $body['common_name'] ?? null,
        'detection_confidence' => (float) ($body['detection_confidence'] ?? 0),
        'detection_type'       => $body['detection_type'] ?? 'visual',
        'is_anonymous'         => 1,
    ]);

    api_success(['detection_id' => $detId]);
    exit;
}

// ===== GET: リアルタイム検出一覧 =====
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('Method not allowed', 405);
}

// Rate limit (高頻度ポーリング想定)
if (!api_rate_limit('live_detections', 30, 60)) {
    api_error('Rate limit exceeded', 429);
}

$lat = api_param('lat', null, 'float');
$lng = api_param('lng', null, 'float');
$radius = api_param('radius', 10, 'float');

// 半径を合理的な範囲に制限
$radius = min(max($radius, 1), 50);

$detections = CanonicalStore::getActiveLiveDetections($lat, $lng, $radius);

// 匿名フラグの処理: is_anonymous の場合 user_id を隠す
$sanitized = array_map(function ($d) {
    if ($d['is_anonymous']) {
        $d['user_id'] = null;
    }
    return $d;
}, $detections);

api_success([
    'detections' => $sanitized,
    'count'      => count($sanitized),
]);
