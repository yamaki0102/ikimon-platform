<?php

/**
 * API v2: Scan Draft Save — センサースキャン下書き保存
 *
 * センサースキャンの写真・予備同定結果を保存する。
 * フィールドノート (observations) とは完全に独立したデータ (scan_drafts) に保存される。
 * フィード・ランキング・観察数のカウント対象外。
 *
 * POST /api/v2/scan_draft_save.php
 *   - photo:       JPEG画像 (必須)
 *   - suggestions: JSON配列 (予備同定結果、任意)
 *   - lat, lng:    GPS座標 (任意)
 *   - accuracy:    GPS精度m (任意)
 *   - session_id:  センサーセッションID (任意)
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Unauthorized', 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST required', 405);
}

if (!api_rate_limit('scan_draft_save', 60, 60)) {
    api_error('Rate limit exceeded', 429);
}

// Validate photo upload
$photo = $_FILES['photo'] ?? null;
if (!$photo || $photo['error'] !== UPLOAD_ERR_OK) {
    api_error('Photo required', 400);
}

// MIME check
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $photo['tmp_name']);
finfo_close($finfo);
if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
    api_error('Invalid image type', 400);
}

$user      = Auth::user();
$userId    = $user['id'];
$sessionId = preg_replace('/[^a-zA-Z0-9_\-]/', '', substr($_POST['session_id'] ?? '', 0, 64));
$lat       = isset($_POST['lat'])      ? (float)$_POST['lat']      : null;
$lng       = isset($_POST['lng'])      ? (float)$_POST['lng']      : null;
$accuracy  = isset($_POST['accuracy']) ? (float)$_POST['accuracy'] : null;

$suggestions = [];
if (!empty($_POST['suggestions'])) {
    $parsed = json_decode($_POST['suggestions'], true);
    if (is_array($parsed)) {
        $suggestions = array_slice($parsed, 0, 5);
    }
}

// Save photo to scan_drafts/photos/
$draftId  = 'sdraft_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3));
$photoDir = DATA_DIR . 'scan_drafts/photos/';
if (!is_dir($photoDir)) {
    mkdir($photoDir, 0755, true);
}
$ext      = $mime === 'image/webp' ? 'webp' : ($mime === 'image/png' ? 'png' : 'jpg');
$filename = $draftId . '.' . $ext;
if (!move_uploaded_file($photo['tmp_name'], $photoDir . $filename)) {
    api_error('Failed to save photo', 500);
}

// Primary suggestion
$primary = $suggestions[0] ?? null;

$draft = [
    'id'             => $draftId,
    'user_id'        => $userId,
    'type'           => 'sensor_scan',
    'photo_filename' => $filename,
    'lat'            => $lat,
    'lng'            => $lng,
    'accuracy'       => $accuracy,
    'timestamp'      => date('c'),
    'session_id'     => $sessionId ?: null,
    'preliminary'    => $primary !== null ? [
        'name'            => (string)($primary['name'] ?? ''),
        'scientific_name' => (string)($primary['scientific_name'] ?? ''),
        'family'          => (string)($primary['family'] ?? ''),
        'genus'           => (string)($primary['genus'] ?? ''),
        'confidence'      => (float)($primary['confidence'] ?? 0),
        'category'        => (string)($primary['category'] ?? ''),
        'note'            => (string)($primary['note'] ?? ''),
        'all_suggestions' => $suggestions,
    ] : null,
    'status'         => 'draft',
    'promoted_to'    => null,
];

// Monthly partition: data/scan_drafts/YYYY-MM.json
$month = date('Y-m');
$file  = DATA_DIR . 'scan_drafts/' . $month . '.json';
if (!is_dir(DATA_DIR . 'scan_drafts/')) {
    mkdir(DATA_DIR . 'scan_drafts/', 0755, true);
}

$existing = [];
if (file_exists($file)) {
    $raw = file_get_contents($file);
    if ($raw !== false) {
        $existing = json_decode($raw, true) ?: [];
    }
}
$existing[] = $draft;
file_put_contents($file, json_encode($existing, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

api_success(['draft_id' => $draftId]);
