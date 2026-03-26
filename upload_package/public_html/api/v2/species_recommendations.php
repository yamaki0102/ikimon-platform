<?php
/**
 * Species Recommendations API — Phase 16
 *
 * GET /api/v2/species_recommendations.php?lat=35.6&lng=139.7
 *
 * Returns: ここで見つかりそうな、まだ見てない種 Top 5
 */

require_once __DIR__ . '/../../../config/config.php';
require_once __DIR__ . '/../../../libs/Auth.php';
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('Method not allowed', 405);
}

$lat = api_param('lat', null, 'float');
$lng = api_param('lng', null, 'float');

if ($lat === null || $lng === null) {
    api_error('lat and lng are required', 400);
}

if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
    api_error('Invalid coordinates', 400);
}

session_start();
$userId = $_SESSION['user_id'] ?? '';
if (empty($userId)) {
    api_error('Login required', 401);
}

api_rate_limit('species_rec', 10, 60);

require_once ROOT_DIR . '/libs/SpeciesRecommender.php';

$month = api_param('month', null, 'int') ?? (int)date('n');
$recommendations = SpeciesRecommender::recommend($lat, $lng, $userId, $month);

api_success([
    'recommendations' => $recommendations,
    'location' => ['lat' => $lat, 'lng' => $lng],
    'month' => $month,
    'count' => count($recommendations),
]);
