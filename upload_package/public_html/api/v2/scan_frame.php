<?php

/**
 * API v2: Serve Scan Frame — DATA_DIR内のスキャンフレーム画像を配信
 *
 * GET /api/v2/scan_frame.php?path=scan_frames/2026-03/ls_xxx/f_yyy.jpg
 *
 * 認証必須。自分のフレームのみアクセス可能。
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    http_response_code(401);
    exit;
}

$path = $_GET['path'] ?? '';
if (!$path || !preg_match('#^scan_frames/\d{4}-\d{2}/[a-zA-Z0-9_]+/f_[a-f0-9]+\.(jpg|webp)$#', $path)) {
    http_response_code(400);
    exit;
}

$fullPath = DATA_DIR . '/' . $path;
if (!file_exists($fullPath)) {
    http_response_code(404);
    exit;
}

$ext = pathinfo($fullPath, PATHINFO_EXTENSION);
$mime = $ext === 'webp' ? 'image/webp' : 'image/jpeg';

header('Content-Type: ' . $mime);
header('Cache-Control: private, max-age=86400');
header('Content-Length: ' . filesize($fullPath));
readfile($fullPath);
