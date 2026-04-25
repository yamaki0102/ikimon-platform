<?php

/**
 * API v2: Quick Post — ライブスキャン中の写真を即座にフィールドノート
 *
 * POST /api/v2/quick_post.php
 *   - photos[]: 1〜3枚のJPEG
 *   - lat, lng: GPS座標
 *   - source: 'live-scan-capture'
 *
 * AI同定は非同期で走る（既存パイプラインに乗せる）
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/AiAssessmentQueue.php';
require_once ROOT_DIR . '/libs/CanonicalObservationWriter.php';
require_once ROOT_DIR . '/libs/ThumbnailGenerator.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Unauthorized', 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST required', 405);
}

if (!api_rate_limit('quick_post', 10, 60)) {
    api_error('Rate limit exceeded', 429);
}

$user = Auth::user();

// 写真を保存
$uploadDir = PUBLIC_DIR . '/uploads/photos/' . date('Y-m');
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

$savedPhotos = [];
$files = $_FILES['photos'] ?? [];

if (!empty($files['name'])) {
    $count = is_array($files['name']) ? count($files['name']) : 1;
    $count = min($count, 3);

    for ($i = 0; $i < $count; $i++) {
        $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
        $error = is_array($files['error']) ? $files['error'][$i] : $files['error'];

        if ($error !== UPLOAD_ERR_OK) continue;

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($tmpName);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'])) continue;

        $filename = 'qp_' . bin2hex(random_bytes(8)) . '.jpg';
        $destPath = $uploadDir . '/' . $filename;

        if (move_uploaded_file($tmpName, $destPath)) {
            $savedPhotos[] = 'uploads/photos/' . date('Y-m') . '/' . $filename;
        }
    }
}

if (empty($savedPhotos)) {
    api_error('No valid photos uploaded', 400);
}

ThumbnailGenerator::generateForObservation(['photos' => $savedPhotos]);

$lat = isset($_POST['lat']) ? floatval($_POST['lat']) : null;
$lng = isset($_POST['lng']) ? floatval($_POST['lng']) : null;

// 観察レコード作成
$obsId = 'qobs_' . bin2hex(random_bytes(8));
$observation = [
    'id' => $obsId,
    'user_id' => $user['id'],
    'user_name' => $user['name'] ?? '',
    'user_avatar' => $user['avatar'] ?? null,
    'photos' => $savedPhotos,
    'lat' => $lat,
    'lng' => $lng,
    'observed_at' => date('Y-m-d H:i:s'),
    'created_at' => date('Y-m-d H:i:s'),
    'taxon' => ['name' => '同定中...', 'scientific_name' => ''],
    'observation_source' => $_POST['source'] ?? 'live-scan-capture',
    'data_quality' => 'C',
    'status' => 'needs_id',
];

DataStore::append('observations', $observation);

$canonicalMeta = [
    'attempted' => false,
    'written' => false,
    'skipped' => false,
];
try {
    $canonicalMeta['attempted'] = true;
    $canonicalResult = CanonicalObservationWriter::writeFromObservation($observation);
    $canonicalMeta['written'] = !($canonicalResult['skipped'] ?? false);
    $canonicalMeta['skipped'] = (bool)($canonicalResult['skipped'] ?? false);
    if (isset($canonicalResult['skip_reason'])) {
        $canonicalMeta['skip_reason'] = $canonicalResult['skip_reason'];
    }
    if (!empty($canonicalResult['occurrence_id'])) {
        $canonicalMeta['occurrence_id'] = $canonicalResult['occurrence_id'];
    }
    if (!empty($canonicalResult['event_id'])) {
        $canonicalMeta['event_id'] = $canonicalResult['event_id'];
    }
} catch (\Throwable $e) {
    $canonicalMeta['error'] = 'canonical_write_failed';
    error_log("quick_post canonical write failed for {$obsId}: " . $e->getMessage());
}

$aiPlan = AiAssessmentQueue::planForObservation($observation, 'observation_created');
if ($aiPlan !== null) {
    try {
        AiAssessmentQueue::enqueue($obsId, (string)$aiPlan['reason'], $aiPlan);
    } catch (\Throwable $e) {
        error_log("enqueue AI failed for quick_post {$obsId}: " . $e->getMessage());
    }
}

api_success([
    'id' => $obsId,
    'photos' => count($savedPhotos),
], [
    'canonical' => $canonicalMeta,
]);
