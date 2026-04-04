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
$sessionId = trim((string)($body['session_id'] ?? ''));
$mode = trim((string)($body['mode'] ?? ''));
$summary = $body['summary'] ?? null;

if ($sessionId === '' || $mode === '' || !is_array($summary)) {
    api_error('session_id, mode, and summary are required.', 400);
}

$record = [
    'id' => 'fds_' . bin2hex(random_bytes(6)),
    'session_id' => $sessionId,
    'mode' => $mode,
    'user_id' => $userId,
    'install_id' => $_GET['install_id'] ?? null,
    'summary' => $summary,
    'engine_counts' => $body['engine_counts'] ?? [],
    'top_events' => $body['top_events'] ?? [],
    'current_location' => $body['current_location'] ?? null,
    'metadata' => $body['metadata'] ?? [],
    'saved_at' => $body['saved_at'] ?? null,
    'created_at' => date('c'),
];

DataStore::append('fieldscan_diagnostics', $record);

api_success([
    'id' => $record['id'],
    'session_id' => $sessionId,
]);
