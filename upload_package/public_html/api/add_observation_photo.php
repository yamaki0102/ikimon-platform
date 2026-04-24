<?php
declare(strict_types=1);
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/ObservationMeta.php';
require_once __DIR__ . '/../../libs/ThumbnailGenerator.php';

header('Content-Type: application/json; charset=utf-8');

function respond(bool $success, string $message, array $data = []): never
{
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $data), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Invalid request method');
}

if (!CSRF::validate($_POST['csrf_token'] ?? '')) {
    respond(false, 'セキュリティトークンが無効です。ページをリロードしてください。');
}

Auth::init();
$currentUser = Auth::user();
if (!$currentUser) {
    respond(false, 'ログインが必要です。');
}

$obsId = trim((string)($_POST['obs_id'] ?? ''));
if ($obsId === '') {
    respond(false, '観察IDが必要です。');
}

$obs = DataStore::findById('observations', $obsId);
if (!$obs) {
    respond(false, '観察が見つかりません。');
}

if (!ObservationMeta::canEditObservation($obs, $currentUser)) {
    respond(false, '写真を追加できるのは投稿者本人のみです。');
}

if (empty($_FILES['photos'])) {
    respond(false, '写真が選択されていません。');
}

$obsDir = app_upload_path('photos/' . $obsId);
if (!is_dir($obsDir) && !mkdir($obsDir, 0777, true)) {
    respond(false, 'フォルダの作成に失敗しました。');
}

$allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
$maxFileSize = 10 * 1024 * 1024;
$useFinfo = class_exists('finfo');
$finfo = $useFinfo ? new finfo(FILEINFO_MIME_TYPE) : null;

$existingPhotos = $obs['photos'] ?? [];
$existingCount = count($existingPhotos);
$maxPhotos = 10;

if ($existingCount >= $maxPhotos) {
    respond(false, '写真は最大' . $maxPhotos . '枚までです。');
}

$addedPhotos = [];
$fileCount = count($_FILES['photos']['name']);
$slot = $existingCount;

for ($i = 0; $i < $fileCount; $i++) {
    if ($slot >= $maxPhotos) break;
    if ($_FILES['photos']['error'][$i] !== UPLOAD_ERR_OK) continue;

    $tmpName = $_FILES['photos']['tmp_name'][$i];

    if ($_FILES['photos']['size'][$i] > $maxFileSize) continue;

    if ($finfo) {
        $detectedMime = $finfo->file($tmpName);
    } else {
        $extMap = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'];
        $fallbackExt = strtolower(pathinfo($_FILES['photos']['name'][$i], PATHINFO_EXTENSION));
        $detectedMime = $extMap[$fallbackExt] ?? 'application/octet-stream';
    }

    if (!in_array($detectedMime, $allowedMimes, true)) continue;

    $ext = strtolower(pathinfo($_FILES['photos']['name'][$i], PATHINFO_EXTENSION) ?: 'jpg');
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) {
        $ext = 'jpg';
    }

    $filename = 'photo_' . $slot . '.' . $ext;
    $target = $obsDir . '/' . $filename;

    if (move_uploaded_file($tmpName, $target)) {
        // Strip EXIF via GD re-encode
        if (extension_loaded('gd')) {
            $imgInfo = getimagesize($target);
            if ($imgInfo) {
                switch ($imgInfo['mime']) {
                    case 'image/jpeg':
                        $img = imagecreatefromjpeg($target);
                        if ($img) { imagejpeg($img, $target, 90); imagedestroy($img); }
                        break;
                    case 'image/png':
                        $img = imagecreatefrompng($target);
                        if ($img) { imagesavealpha($img, true); imagepng($img, $target, 9); imagedestroy($img); }
                        break;
                    case 'image/webp':
                        $img = imagecreatefromwebp($target);
                        if ($img) { imagewebp($img, $target, 90); imagedestroy($img); }
                        break;
                }
            }
        }

        $photoPath = 'uploads/photos/' . $obsId . '/' . $filename;
        $addedPhotos[] = $photoPath;
        $existingPhotos[] = $photoPath;
        $slot++;
    }
}

if (empty($addedPhotos)) {
    respond(false, '写真のアップロードに失敗しました。ファイル形式やサイズを確認してください。');
}

ThumbnailGenerator::generateForObservation(['photos' => $addedPhotos]);

$obs['photos'] = $existingPhotos;
$obs['updated_at'] = date('c');
DataStore::upsert('observations', $obs);

respond(true, count($addedPhotos) . '枚の写真を追加しました。', ['added' => $addedPhotos, 'total' => count($existingPhotos)]);
