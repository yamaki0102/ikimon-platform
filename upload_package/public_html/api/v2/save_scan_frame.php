<?php

/**
 * API v2: Save Scan Frame — ライブスキャンのキーフレームを保存
 *
 * 新種検出・高信頼度検出の瞬間のフレームのみを選択的に保存。
 * 100年後の再解析・エビデンス証拠用。
 *
 * POST /api/v2/save_scan_frame.php
 *   - frame: JPEG画像
 *   - session_id: セッションID（ディレクトリ分割用）
 *   - taxon_name: 検出された種名
 *   - confidence: 信頼度
 *   - lat, lng: GPS座標（任意）
 *
 * Response: { success: true, data: { frame_ref: "scan_frames/2026-03/ps_xxx/frame_abc.jpg" } }
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

if (!api_rate_limit('save_scan_frame', 20, 60)) {
    api_error('Rate limit exceeded', 429);
}

if (!isset($_FILES['frame']) || $_FILES['frame']['error'] !== UPLOAD_ERR_OK) {
    api_error('No frame', 400);
}

$file = $_FILES['frame'];
if ($file['size'] > 200 * 1024) {
    api_error('Frame too large (max 200KB)', 400);
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);
if (!in_array($mime, ['image/jpeg', 'image/webp'], true)) {
    api_error('Invalid image type', 400);
}

$sessionId = preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['session_id'] ?? 'unknown');
$yearMonth = date('Y-m');

$dir = DATA_DIR . "/scan_frames/{$yearMonth}/{$sessionId}";
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

$frameId = 'f_' . bin2hex(random_bytes(6));
$ext = ($mime === 'image/webp') ? 'webp' : 'jpg';
$filename = "{$frameId}.{$ext}";
$filepath = "{$dir}/{$filename}";

if (!move_uploaded_file($file['tmp_name'], $filepath)) {
    api_error('Failed to save frame', 500);
}

$frameRef = "scan_frames/{$yearMonth}/{$sessionId}/{$filename}";

$meta = [
    'frame_ref' => $frameRef,
    'taxon_name' => $_POST['taxon_name'] ?? '',
    'confidence' => (float) ($_POST['confidence'] ?? 0),
    'lat' => isset($_POST['lat']) ? (float) $_POST['lat'] : null,
    'lng' => isset($_POST['lng']) ? (float) $_POST['lng'] : null,
    'size_bytes' => filesize($filepath),
    'timestamp' => date('c'),
];

api_success(['frame_ref' => $frameRef, 'meta' => $meta]);
