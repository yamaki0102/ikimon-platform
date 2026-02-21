<?php

/**
 * API: Save GPS track points (batch)
 * POST {field_id, session_id, points: [{lat, lng, accuracy, altitude, timestamp}, ...]}
 *
 * Dual Write strategy: client saves to IndexedDB + POSTs here for server persistence.
 */
require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/MyFieldManager.php';
require_once ROOT_DIR . '/libs/CSRF.php';

header('Content-Type: application/json; charset=utf-8');

Auth::init();
CSRF::validateRequest();
$user = Auth::user();

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$fieldId   = $input['field_id'] ?? null;
$sessionId = $input['session_id'] ?? null;
$points    = $input['points'] ?? [];

// Validation
if (empty($sessionId)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'session_id is required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (empty($points) || !is_array($points)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'points array is required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Validate field ownership (if field_id provided)
if ($fieldId) {
    $field = MyFieldManager::get($fieldId);
    if (!$field || ($field['user_id'] ?? '') !== $user['id']) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Field not found or not owned'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }
}

// Sanitize and validate points
$sanitized = [];
foreach ($points as $pt) {
    $lat = (float)($pt['lat'] ?? 0);
    $lng = (float)($pt['lng'] ?? 0);
    if ($lat === 0.0 && $lng === 0.0) continue;

    $sanitized[] = [
        'lat'       => $lat,
        'lng'       => $lng,
        'accuracy'  => (float)($pt['accuracy'] ?? 0),
        'altitude'  => $pt['altitude'] ?? null,
        'timestamp' => (int)($pt['timestamp'] ?? 0),
    ];
}

if (empty($sanitized)) {
    echo json_encode(['success' => true, 'saved' => 0, 'message' => 'No valid points'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Storage: DATA_DIR/tracks/{user_id}/{session_id}.json
$trackDir = DATA_DIR . '/tracks/' . $user['id'];
if (!file_exists($trackDir)) {
    mkdir($trackDir, 0777, true);
}

$trackFile = $trackDir . '/' . $sessionId . '.json';

// Append to existing session or create new
$existing = [];
if (file_exists($trackFile)) {
    $existing = json_decode(file_get_contents($trackFile), true) ?: [];
}

if (empty($existing)) {
    $existing = [
        'session_id' => $sessionId,
        'user_id'    => $user['id'],
        'field_id'   => $fieldId,
        'started_at' => date('c'),
        'points'     => [],
    ];
}

// Append new points
$existing['points'] = array_merge($existing['points'], $sanitized);
$existing['updated_at'] = date('c');
$existing['point_count'] = count($existing['points']);

// Calculate total distance
$totalDist = 0;
$pts = $existing['points'];
for ($i = 1; $i < count($pts); $i++) {
    $totalDist += haversineDistance(
        $pts[$i - 1]['lat'],
        $pts[$i - 1]['lng'],
        $pts[$i]['lat'],
        $pts[$i]['lng']
    );
}
$existing['total_distance_m'] = round($totalDist, 1);

file_put_contents($trackFile, json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG));

echo json_encode([
    'success'        => true,
    'saved'          => count($sanitized),
    'total_points'   => $existing['point_count'],
    'total_distance' => $existing['total_distance_m'],
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);

/**
 * Haversine distance in meters.
 */
function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $R = 6371e3;
    $phi1 = deg2rad($lat1);
    $phi2 = deg2rad($lat2);
    $dPhi = deg2rad($lat2 - $lat1);
    $dLam = deg2rad($lng2 - $lng1);

    $a = sin($dPhi / 2) ** 2 + cos($phi1) * cos($phi2) * sin($dLam / 2) ** 2;
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

    return $R * $c;
}
