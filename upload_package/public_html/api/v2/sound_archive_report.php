<?php

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/CSRF.php';
require_once ROOT_DIR . '/libs/DataStore.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('Method not allowed', 405);
}

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Unauthorized', 401);
}
CSRF::validate();

$body = api_json_body();
$archiveId = $body['archive_id'] ?? '';
$reason    = $body['reason'] ?? '';

if (!$archiveId || !$reason) {
    api_error('archive_id and reason are required', 400);
}

$allowedReasons = ['human_voice', 'inappropriate', 'noise'];
if (!in_array($reason, $allowedReasons, true)) {
    api_error('Invalid reason. Must be: human_voice, inappropriate, or noise', 400);
}

$all = DataStore::fetchAll('sound_archive');
$recordIndex = null;
$record = null;
foreach ($all as $i => $item) {
    if (($item['id'] ?? '') === $archiveId) {
        $recordIndex = $i;
        $record = $item;
        break;
    }
}

if (!$record) {
    api_error('Archive record not found', 404);
}

$userId = Auth::user()['id'] ?? '';

// Ensure reports structure exists
if (!isset($record['reports'])) {
    $record['reports'] = ['human_voice' => [], 'inappropriate' => [], 'noise' => []];
}
if (!isset($record['reports'][$reason])) {
    $record['reports'][$reason] = [];
}

// Duplicate check
if (in_array($userId, $record['reports'][$reason], true)) {
    api_error('You have already reported this record', 409);
}

$record['reports'][$reason][] = $userId;

// Auto-hide thresholds
$thresholds = [
    'human_voice'   => 3,
    'inappropriate' => 2,
    'noise'         => 5,
];

$reportCount = count($record['reports'][$reason]);
if ($reportCount >= ($thresholds[$reason] ?? 99)) {
    $record['hidden'] = true;
    $record['hidden_reason'] = $reason;
}

$all[$recordIndex] = $record;
$yearMonth = substr($record['created_at'] ?? date('c'), 0, 7);
DataStore::save("sound_archive/{$yearMonth}", $all);

api_success([
    'reported'     => true,
    'reason'       => $reason,
    'report_count' => $reportCount,
    'hidden'       => $record['hidden'],
]);
