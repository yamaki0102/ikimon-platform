<?php

/**
 * API v2: Scan Recommendations — フィールドスキャン推奨エリア
 *
 * GET /api/v2/scan_recommendations.php?lat=34.71&lng=137.73&radius=5
 *
 * GBIF/iNaturalist の広域データとikimonローカルデータを突合し、
 * スキャンすべき推奨エリアをスコア付きで返す。
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/ScanRecommendationEngine.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('Method not allowed', 405);
}

if (!api_rate_limit('scan_rec', 10, 60)) {
    api_error('Rate limit exceeded', 429);
}

$lat = api_param('lat', null, 'float');
$lng = api_param('lng', null, 'float');
$radius = api_param('radius', 5, 'int');

if ($lat === null || $lng === null) {
    api_error('lat and lng are required', 400);
}

if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
    api_error('Invalid coordinates', 400);
}

$radius = max(1, min(10, $radius));

Auth::init();
$userId = Auth::isLoggedIn() ? Auth::user()['id'] : null;

$result = ScanRecommendationEngine::recommend($lat, $lng, $userId, $radius);

api_success([
    'recommendations' => $result['recommendations'] ?? [],
    'count' => count($result['recommendations'] ?? []),
    'center' => ['lat' => $lat, 'lng' => $lng],
    'radius_km' => $radius,
    'summary' => $result['summary'] ?? [],
]);
