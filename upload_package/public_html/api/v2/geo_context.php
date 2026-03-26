<?php

/**
 * API v2: GeoContext — 座標の環境文脈を取得
 *
 * GET /api/v2/geo_context.php?lat=34.71&lng=137.73
 *
 * Returns: { land_use, nearest_water, nearest_park, trails[], green_features[], environment_label, environment_icon }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/GeoContext.php';

if (!api_rate_limit('geo_context', 30, 60)) {
    api_error('Rate limit exceeded', 429);
}

$lat = isset($_GET['lat']) ? floatval($_GET['lat']) : 0;
$lng = isset($_GET['lng']) ? floatval($_GET['lng']) : 0;

if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180 || ($lat == 0 && $lng == 0)) {
    api_error('Invalid coordinates', 400);
}

try {
    $context = GeoContext::getContext($lat, $lng);
    api_success($context);
} catch (Throwable $e) {
    error_log("[geo_context] Error: " . $e->getMessage());
    api_error('Internal error', 500);
}
