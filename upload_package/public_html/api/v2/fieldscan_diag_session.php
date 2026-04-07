<?php

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/UserStore.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST method required.', 405);
}

Auth::init();
$userId = null;

if (Auth::isLoggedIn()) {
    $user = Auth::user();
    $userId = $user['id'] ?? null;
} else {
    $installId = $_GET['install_id'] ?? null;
    if ($installId) {
        $installs = DataStore::get('fieldscan_installs') ?? [];
        foreach ($installs as $inst) {
            if (($inst['install_id'] ?? '') === $installId && ($inst['status'] ?? 'active') === 'active') {
                $userId = $inst['user_id'] ?? null;
                break;
            }
        }
    }
}

if (empty($userId)) {
    api_error('Authentication required.', 401);
}

if (!api_rate_limit('fieldscan_diag_session', 30, 60)) {
    api_error('Rate limit exceeded.', 429);
}

$body = api_json_body();
if (!is_array($body)) {
    api_error('Invalid request body.', 400);
}

$sessionId = trim((string)($body['session_id'] ?? ''));
$mode = trim((string)($body['mode'] ?? ''));
$summary = $body['summary'] ?? null;

if ($sessionId === '' || $mode === '' || !is_array($summary)) {
    api_error('session_id, mode, and summary are required.', 400);
}

if (!preg_match('/^[a-zA-Z0-9_\-]{1,64}$/', $sessionId)) {
    api_error('Invalid session_id format.', 400);
}

if (!in_array($mode, ['walk', 'live-scan', 'drive', 'stationary', 'bike', 'diagnostic'], true)) {
    api_error('Invalid mode.', 400);
}

$clientSavedAt = $body['saved_at'] ?? null;
if ($clientSavedAt !== null) {
    $ts = strtotime($clientSavedAt);
    if ($ts === false || $ts > time() + 300) {
        $clientSavedAt = null;
    }
}

$record = [
    'id' => 'fds_' . bin2hex(random_bytes(6)),
    'session_id' => $sessionId,
    'mode' => $mode,
    'user_id' => $userId,
    'install_id' => $_GET['install_id'] ?? null,
    'summary' => $summary,
    'engine_counts' => is_array($body['engine_counts'] ?? null) ? $body['engine_counts'] : [],
    'top_events' => is_array($body['top_events'] ?? null) ? array_slice($body['top_events'], 0, 50) : [],
    'current_location' => $body['current_location'] ?? null,
    'metadata' => is_array($body['metadata'] ?? null) ? $body['metadata'] : [],
    'saved_at' => $clientSavedAt,
    'created_at' => date('c'),
];

DataStore::append('fieldscan_diagnostics', $record);

api_success([
    'id' => $record['id'],
    'session_id' => $sessionId,
]);
