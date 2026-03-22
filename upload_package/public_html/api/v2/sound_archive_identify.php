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
$archiveId     = $body['archive_id'] ?? '';
$suggestedName = trim($body['suggested_name'] ?? '');
$category      = $body['category'] ?? 'unknown';
$confidSelf    = $body['confidence_self'] ?? 'guess';
$comment       = trim($body['comment'] ?? '');

if (!$archiveId || !$suggestedName) {
    api_error('archive_id and suggested_name are required', 400);
}

$allowedCategories = ['bird', 'insect', 'frog', 'mammal', 'fish', 'other', 'unknown'];
if (!in_array($category, $allowedCategories, true)) {
    $category = 'unknown';
}

$allowedConfidence = ['certain', 'likely', 'guess'];
if (!in_array($confidSelf, $allowedConfidence, true)) {
    $confidSelf = 'guess';
}

// Find the record
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

// Duplicate check
foreach ($record['identifications'] ?? [] as $ident) {
    if (($ident['user_id'] ?? '') === $userId) {
        api_error('You have already submitted an identification for this record', 409);
    }
}

// Add identification
$identification = [
    'id'              => 'ident_' . bin2hex(random_bytes(4)),
    'user_id'         => $userId,
    'suggested_name'  => htmlspecialchars($suggestedName, ENT_QUOTES, 'UTF-8'),
    'scientific_name' => htmlspecialchars($body['scientific_name'] ?? '', ENT_QUOTES, 'UTF-8'),
    'category'        => $category,
    'confidence_self' => $confidSelf,
    'comment'         => htmlspecialchars($comment, ENT_QUOTES, 'UTF-8'),
    'created_at'      => date('c'),
];

$record['identifications'][] = $identification;

// Auto-promote identification_status based on name consensus
$nameCounts = [];
foreach ($record['identifications'] as $ident) {
    $name = $ident['suggested_name'] ?? '';
    if ($name) {
        $nameCounts[$name] = ($nameCounts[$name] ?? 0) + 1;
    }
}

$maxCount = max($nameCounts ?: [0]);
if ($maxCount >= 3) {
    $record['identification_status'] = 'identified';
} elseif ($maxCount >= 2) {
    $record['identification_status'] = 'suggested';
}

// Save back — rewrite the partition file
$all[$recordIndex] = $record;
$yearMonth = substr($record['created_at'] ?? date('c'), 0, 7);
DataStore::save("sound_archive/{$yearMonth}", $all);

api_success([
    'identification'      => $identification,
    'identification_status' => $record['identification_status'],
    'total_identifications' => count($record['identifications']),
]);
