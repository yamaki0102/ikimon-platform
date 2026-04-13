<?php

/**
 * FB-38: NPS Survey API Endpoint
 * Records NPS scores and feedback
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/RateLimiter.php';
require_once __DIR__ . '/../../libs/CSRF.php';

Auth::init();
CSRF::validateRequest();
RateLimiter::check();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$score = isset($input['score']) ? intval($input['score']) : null;
$feedback = trim($input['feedback'] ?? '');

if ($score === null || $score < 0 || $score > 10) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid score'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$user = Auth::user();

$npsEntry = [
    'id' => uniqid('nps_'),
    'score' => $score,
    'feedback' => $feedback,
    'user_id' => $user['id'] ?? null,
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
    'created_at' => date('c')
];

// Store NPS data
$npsData = DataStore::fetchAll('nps') ?: [];
$npsData[] = $npsEntry;
DataStore::save('nps.json', $npsData);

// Calculate NPS score for logging
$scores = array_column($npsData, 'score');
$promoters = count(array_filter($scores, fn($s) => $s >= 9));
$detractors = count(array_filter($scores, fn($s) => $s <= 6));
$total = count($scores);
$npsScore = $total > 0 ? round((($promoters - $detractors) / $total) * 100) : 0;

echo json_encode([
    'success' => true,
    'message' => 'Thank you for your feedback!',
    'current_nps' => $npsScore,
    'total_responses' => $total
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
