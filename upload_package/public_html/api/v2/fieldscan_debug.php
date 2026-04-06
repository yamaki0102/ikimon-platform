<?php

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/ContributionLedger.php';

Auth::init();
Auth::requireRole('Analyst');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('GET required', 405);
}

if (!api_rate_limit('fieldscan_debug', 30, 60)) {
    api_error('Rate limit exceeded', 429);
}

$sessionId = trim((string)($_GET['session_id'] ?? ''));
$limit = max(1, min(50, (int)($_GET['limit'] ?? 20)));

$payload = [
    'community' => ContributionLedger::getCommunitySnapshot(),
    'recent_sessions' => ContributionLedger::listRecentSessions($limit),
];

if ($sessionId !== '') {
    $debug = ContributionLedger::getSessionDebug($sessionId);
    if ($debug === null) {
        api_error('Session not found', 404, ['session_id' => $sessionId]);
    }
    $payload['session'] = $debug;
}

api_success($payload);
