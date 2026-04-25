<?php

/**
 * Upload Avatar API
 * Accepts multipart/form-data with 'avatar' file field.
 * Saves to uploads/avatars/ and updates user record.
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';
require_once __DIR__ . '/../../libs/UserStore.php';

Auth::init();
CSRF::validateRequest();
header('Content-Type: application/json; charset=utf-8');

$user = Auth::user();
if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'ファイルのアップロードに失敗しました。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$file = $_FILES['avatar'];

// Validate size (5MB max — client-side compression handles most cases)
if ($file['size'] > 5 * 1024 * 1024) {
    echo json_encode(['success' => false, 'message' => '画像は5MB以下にしてください。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Validate type
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
if (class_exists('finfo')) {
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);
} else {
    // Fallback: extension-based MIME detection when fileinfo is unavailable
    $extMap = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $mimeType = $extMap[$ext] ?? 'application/octet-stream';
}
if (!in_array($mimeType, $allowedTypes)) {
    echo json_encode(['success' => false, 'message' => 'JPEG、PNG、WebPのみアップロードできます。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Determine extension
$extMap = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
$ext = $extMap[$mimeType] ?? 'jpg';

// Create uploads/avatars directory
$avatarDir = __DIR__ . '/../uploads/avatars';
if (!is_dir($avatarDir)) {
    mkdir($avatarDir, 0755, true);
}

// Generate filename: user_id + timestamp
$filename = $user['id'] . '_' . time() . '.' . $ext;
$destPath = $avatarDir . '/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    echo json_encode(['success' => false, 'message' => 'ファイルの保存に失敗しました。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Build URL path
$avatarUrl = 'uploads/avatars/' . $filename;

// Update user record
UserStore::update($user['id'], ['avatar' => $avatarUrl]);

// Update session
$user['avatar'] = $avatarUrl;
Auth::login($user);

// Sync denormalized avatar in all observation files
$obsDir = __DIR__ . '/../../data/observations';
if (is_dir($obsDir)) {
    foreach (glob($obsDir . '/*.json') as $file) {
        $data = json_decode(file_get_contents($file), true);
        if (!is_array($data)) continue;
        $changed = false;
        foreach ($data as &$obs) {
            if (($obs['user_id'] ?? '') === $user['id'] && ($obs['user_avatar'] ?? '') !== $avatarUrl) {
                $obs['user_avatar'] = $avatarUrl;
                $changed = true;
            }
        }
        unset($obs);
        if ($changed) {
            file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }
    }
}

echo json_encode([
    'success' => true,
    'message' => 'アバターを更新しました。',
    'avatar_url' => $avatarUrl,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
