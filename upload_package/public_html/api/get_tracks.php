<?php

/**
 * API: Get track sessions
 * GET ?field_id={id} (optional)
 * GET ?session_id={id} (optional)
 * 
 * If session_id is provided: Returns full track points for that session.
 * If field_id is provided: Returns list of sessions linked to that field.
 * If neither: Returns ALL sessions for the authenticated user (Activity Log).
 */
require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/MyFieldManager.php';

header('Content-Type: application/json; charset=utf-8');

Auth::init();
$user = Auth::user();

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Login required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$fieldId   = $_GET['field_id'] ?? null;
$sessionId = $_GET['session_id'] ?? null;

// 1. Get specific session details (Track Points + Observations)
if ($sessionId) {
    // Phase 3.5: Use enriched session data (with Linked Observations)
    $data = MyFieldManager::getSessionWithObservations($user['id'], $sessionId);

    if (!$data) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Track not found or access denied'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    echo json_encode(['success' => true, 'track' => $data], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// 2. List sessions (Activity Log)
// If fieldId is present, filter by it. If null, return all user's sessions.
$sessions = MyFieldManager::getUserTracks($user['id']);

if ($fieldId) {
    $sessions = array_filter($sessions, fn($s) => ($s['field_id'] ?? '') === $fieldId);
}

// Sort by date desc
usort($sessions, fn($a, $b) => strcmp($b['started_at'] ?? '', $a['started_at'] ?? ''));

echo json_encode([
    'success'  => true,
    'sessions' => array_values($sessions),
    // Stats currently only make sense if filtered by field, but we can return global stats too if needed
    'stats'    => $fieldId ? MyFieldManager::getTrackStats($fieldId) : null,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
