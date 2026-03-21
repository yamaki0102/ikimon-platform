<?php
/**
 * Distribution Check API — Phase 16
 *
 * GET /api/v2/distribution_check.php?species=スズメ&lat=35.6&lng=139.7
 *
 * Returns: 分布異常情報（地域初記録、珍しい観察）
 */

require_once __DIR__ . '/../../../config/config.php';
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('Method not allowed', 405);
}

$species = api_param('species', '', 'string');
$lat = api_param('lat', null, 'float');
$lng = api_param('lng', null, 'float');

if (empty($species) || $lat === null || $lng === null) {
    api_error('species, lat, and lng are required', 400);
}

api_rate_limit('dist_check', 30, 60);

require_once ROOT_DIR . '/libs/DistributionAnalyzer.php';

$result = DistributionAnalyzer::checkRarity($species, $lat, $lng);

api_success($result);
