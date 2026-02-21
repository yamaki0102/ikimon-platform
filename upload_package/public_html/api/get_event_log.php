<?php

/**
 * get_event_log.php — ユーザーの観察会ライフログ API
 *
 * GET params:
 *   - user_id (str): required, target user
 *
 * Returns:
 *   { success: true, events_by_year: { "2026": [...] }, stats: {...} }
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Services/EventLogService.php';

$userId = $_GET['user_id'] ?? '';

if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'user_id is required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$eventsByYear = EventLogService::getUserEventHistory($userId);
$stats = EventLogService::getUserEventStats($userId);

echo json_encode([
    'success' => true,
    'events_by_year' => $eventsByYear,
    'stats' => $stats,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
