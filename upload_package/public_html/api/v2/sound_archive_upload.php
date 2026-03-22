<?php

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/CSRF.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/GeoUtils.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('Method not allowed', 405);
}

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Unauthorized', 401);
}
CSRF::validate();

if (!api_rate_limit('sound_upload', 10, 60)) {
    api_error('Rate limit exceeded', 429);
}

// --- Audio validation (required) ---
if (!isset($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
    api_error('No audio file or upload error', 400);
}

$audioFile = $_FILES['audio'];
if ($audioFile['size'] > 5 * 1024 * 1024) {
    api_error('Audio file too large (max 5MB)', 413);
}

$allowedAudioMimes = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/mpeg', 'video/webm', 'audio/x-m4a', 'audio/aac'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$audioMime = $finfo->file($audioFile['tmp_name']);
if (!in_array($audioMime, $allowedAudioMimes, true)) {
    api_error("Unsupported audio format: {$audioMime}", 415);
}

// --- Image validation (optional) ---
$imagePath = null;
if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
    $imgFile = $_FILES['image'];
    if ($imgFile['size'] > 10 * 1024 * 1024) {
        api_error('Image too large (max 10MB)', 413);
    }

    $allowedImgMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    $imgMime = $finfo->file($imgFile['tmp_name']);
    if (!in_array($imgMime, $allowedImgMimes, true)) {
        api_error("Unsupported image format: {$imgMime}", 415);
    }

    $yearMonth = date('Y-m');
    $imgDir = PUBLIC_DIR . "/uploads/images/archive/{$yearMonth}";
    if (!is_dir($imgDir)) mkdir($imgDir, 0755, true);

    $imgId = bin2hex(random_bytes(8));
    $imgExt = match ($imgMime) {
        'image/jpeg' => '.jpg',
        'image/png'  => '.png',
        'image/gif'  => '.gif',
        default      => '.webp',
    };

    // Convert to WebP if not already
    if ($imgMime !== 'image/webp' && function_exists('imagecreatefromstring')) {
        $imgData = file_get_contents($imgFile['tmp_name']);
        $gd = imagecreatefromstring($imgData);
        if ($gd) {
            $imgExt = '.webp';
            $imgDest = "{$imgDir}/sa_img_{$imgId}{$imgExt}";
            imagewebp($gd, $imgDest, 85);
            imagedestroy($gd);
            $imagePath = "uploads/images/archive/{$yearMonth}/sa_img_{$imgId}{$imgExt}";
        }
    }

    if (!$imagePath) {
        $imgDest = "{$imgDir}/sa_img_{$imgId}{$imgExt}";
        move_uploaded_file($imgFile['tmp_name'], $imgDest);
        $imagePath = "uploads/images/archive/{$yearMonth}/sa_img_{$imgId}{$imgExt}";
    }
}

// --- Save audio ---
$yearMonth = date('Y-m');
$audioDir = PUBLIC_DIR . "/uploads/audio/archive/{$yearMonth}";
if (!is_dir($audioDir)) mkdir($audioDir, 0755, true);

$id = 'sa_' . bin2hex(random_bytes(8));
$audioExt = match ($audioMime) {
    'audio/webm', 'video/webm' => '.webm',
    'audio/mp4', 'audio/x-m4a', 'audio/aac' => '.m4a',
    'audio/wav', 'audio/x-wav', 'audio/wave' => '.wav',
    'audio/ogg' => '.ogg',
    'audio/mpeg' => '.mp3',
    default => '.webm',
};
$audioFilename = "{$id}{$audioExt}";
$audioDest = "{$audioDir}/{$audioFilename}";

if (!move_uploaded_file($audioFile['tmp_name'], $audioDest)) {
    api_error('Failed to save audio', 500);
}

$audioRelPath = "uploads/audio/archive/{$yearMonth}/{$audioFilename}";
$audioHash = hash_file('sha256', $audioDest);

// --- Location ---
$lat = floatval($_POST['lat'] ?? 0);
$lng = floatval($_POST['lng'] ?? 0);
$areaName = '';
if ($lat && $lng) {
    try {
        $geo = GeoUtils::reverseGeocode($lat, $lng);
        $areaName = trim(($geo['prefecture'] ?? '') . ' ' . ($geo['municipality'] ?? ''));
    } catch (Throwable $e) {}
}

$category = $_POST['category'] ?? 'unknown';
$memo = $_POST['memo'] ?? '';

$user = Auth::user();

$record = [
    'id'                    => $id,
    'user_id'               => $user['id'] ?? '',
    'audio_path'            => $audioRelPath,
    'audio_hash'            => $audioHash,
    'image_path'            => $imagePath,
    'duration_ms'           => null,
    'recorded_at'           => date('c'),
    'location'              => [
        'lat'       => $lat,
        'lng'       => $lng,
        'accuracy'  => floatval($_POST['gps_accuracy'] ?? 0),
        'area_name' => $areaName ?: '不明',
    ],
    'source'                => 'manual',
    'category'              => $category,
    'memo'                  => htmlspecialchars($memo, ENT_QUOTES, 'UTF-8'),
    'birdnet_result'        => null,
    'identification_status' => 'needs_id',
    'identifications'       => [],
    'reports'               => ['human_voice' => [], 'inappropriate' => [], 'noise' => []],
    'hidden'                => false,
    'hidden_reason'         => null,
    'created_at'            => date('c'),
];

DataStore::append('sound_archive', $record);

api_success([
    'id'         => $id,
    'audio_path' => $audioRelPath,
    'image_path' => $imagePath,
]);
