<?php

/**
 * API v2: Survey Recommendations
 *
 * GET /api/v2/recommendations.php?lat=35.6&lng=139.7
 *
 * 現在地に基づく調査提案を返す。
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/SurveyRecommender.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('Method not allowed', 405);
}

Auth::init();
$userId = Auth::isLoggedIn() ? Auth::user()['id'] : null;

$lat = api_param('lat', null, 'float');
$lng = api_param('lng', null, 'float');

$recommendations = SurveyRecommender::recommend($lat, $lng, $userId);

api_success([
    'recommendations' => $recommendations,
    'count'           => count($recommendations),
]);
