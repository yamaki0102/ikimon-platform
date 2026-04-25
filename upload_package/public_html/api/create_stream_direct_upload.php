<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/CloudflareStream.php';

function respondJson(bool $success, string $message, array $data = []): void
{
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message,
    ], $data), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respondJson(false, 'Invalid request method');
}

if (!CloudflareStream::isConfigured()) {
    respondJson(false, 'Cloudflare Stream is not configured.');
}

if (!CSRF::validate($_POST['csrf_token'] ?? '')) {
    respondJson(false, 'セキュリティトークンが無効です。ページをリロードしてください。');
}

Auth::init();
Auth::initGuest();
$currentUser = Auth::user();
$actorId = $currentUser['id'] ?? Auth::getGuestId();

$maxDurationSeconds = max(6, min(15, (int)($_POST['max_duration_seconds'] ?? 15)));
$requestedName = trim((string)($_POST['filename'] ?? ''));
$meta = [
    'ikimon_actor' => $actorId,
    'ikimon_origin' => 'post.php',
];
if ($requestedName !== '') {
    $meta['name'] = mb_substr($requestedName, 0, 120);
}

try {
    $response = CloudflareStream::createDirectUpload([
        'maxDurationSeconds' => $maxDurationSeconds,
        'meta' => $meta,
    ]);
} catch (Throwable $e) {
    respondJson(false, '動画アップロードURLの発行に失敗しました。', [
        'error' => $e->getMessage(),
    ]);
}

$result = is_array($response['result'] ?? null) ? $response['result'] : [];
$uid = (string)($result['uid'] ?? '');
$uploadUrl = (string)($result['uploadURL'] ?? '');
if ($uid === '' || $uploadUrl === '') {
    respondJson(false, 'Cloudflare Stream response is missing upload information.');
}

DataStore::upsert('system/cloudflare_stream_uploads', [
    'id' => $uid,
    'uid' => $uid,
    'actor_id' => $actorId,
    'user_id' => $currentUser['id'] ?? null,
    'is_guest' => $currentUser ? false : true,
    'status' => 'issued',
    'max_duration_seconds' => $maxDurationSeconds,
    'created_at' => date('c'),
    'updated_at' => date('c'),
    'filename' => $requestedName,
    'meta' => $meta,
], 'id');

respondJson(true, 'Upload URL created.', [
    'uid' => $uid,
    'upload_url' => $uploadUrl,
    'iframe_url' => CloudflareStream::buildIframeUrl($uid),
    'watch_url' => CloudflareStream::buildWatchUrl($uid),
    'thumbnail_url' => CloudflareStream::buildThumbnailUrl($uid),
    'max_duration_seconds' => $maxDurationSeconds,
]);
