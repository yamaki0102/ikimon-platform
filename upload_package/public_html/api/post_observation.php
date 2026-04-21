<?php
header('Content-Type: application/json; charset=utf-8');
$requestStartedAt = microtime(true);

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/RateLimiter.php';
require_once __DIR__ . '/../../libs/SurveyManager.php';
require_once __DIR__ . '/../../libs/StreakTracker.php';
require_once __DIR__ . '/../../libs/Taxonomy.php';
require_once __DIR__ . '/../../libs/ObservationRecalcQueue.php';
require_once __DIR__ . '/../../libs/ManagedSiteRegistry.php';
require_once __DIR__ . '/../../libs/AiAssessmentQueue.php';
require_once __DIR__ . '/../../libs/EmbeddingQueue.php';
require_once __DIR__ . '/../../libs/AsyncJobMetrics.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/Gamification.php';
require_once __DIR__ . '/../../libs/BioUtils.php';
require_once __DIR__ . '/../../libs/GeoUtils.php';
require_once __DIR__ . '/../../libs/SurveyorManager.php';
require_once __DIR__ . '/../../libs/CanonicalObservationWriter.php';
require_once __DIR__ . '/../../libs/CloudflareStream.php';
require_once __DIR__ . '/../../libs/ThumbnailGenerator.php';

// FB-12: Apply post-specific rate limiting (10 posts / 5 min)
RateLimiter::check();
RateLimiter::checkPost();

/**
 * FB-15: Extract EXIF metadata (date, GPS) before stripping
 * Returns extracted date and GPS coordinates if available
 *
 * @param string $filepath Path to the image file
 * @return array ['date' => string|null, 'lat' => float|null, 'lng' => float|null]
 */
function extractExifData($filepath)
{
    $result = ['date' => null, 'lat' => null, 'lng' => null];

    if (!function_exists('exif_read_data') || !file_exists($filepath)) {
        return $result;
    }

    // exif_read_data only works on JPEG/TIFF
    $imageInfo = @getimagesize($filepath);
    if (!$imageInfo || !in_array($imageInfo['mime'], ['image/jpeg', 'image/tiff'])) {
        return $result;
    }

    try {
        $exif = @exif_read_data($filepath, 'ANY_TAG', true);
        if (!$exif) return $result;

        // Extract date: DateTimeOriginal > DateTimeDigitized > DateTime
        $dateKeys = [
            ['EXIF', 'DateTimeOriginal'],
            ['EXIF', 'DateTimeDigitized'],
            ['IFD0', 'DateTime'],
        ];
        foreach ($dateKeys as [$section, $key]) {
            if (!empty($exif[$section][$key])) {
                $rawDate = $exif[$section][$key];
                // EXIF format: "2025:01:15 14:30:00" → "2025-01-15 14:30"
                $parsed = DateTime::createFromFormat('Y:m:d H:i:s', $rawDate);
                if ($parsed) {
                    $result['date'] = $parsed->format('Y-m-d H:i');
                    break;
                }
            }
        }

        // Extract GPS coordinates
        if (!empty($exif['GPS']['GPSLatitude']) && !empty($exif['GPS']['GPSLongitude'])) {
            $lat = gpsToDecimal(
                $exif['GPS']['GPSLatitude'],
                $exif['GPS']['GPSLatitudeRef'] ?? 'N'
            );
            $lng = gpsToDecimal(
                $exif['GPS']['GPSLongitude'],
                $exif['GPS']['GPSLongitudeRef'] ?? 'E'
            );
            if ($lat !== null && $lng !== null) {
                $result['lat'] = $lat;
                $result['lng'] = $lng;
            }
        }
    } catch (Exception $e) {
        error_log('EXIF read error: ' . $e->getMessage());
    }

    return $result;
}

/**
 * Convert GPS DMS (degrees/minutes/seconds) to decimal
 */
function gpsToDecimal($dms, $ref)
{
    if (!is_array($dms) || count($dms) < 3) return null;

    $deg = evaluateGpsComponent($dms[0]);
    $min = evaluateGpsComponent($dms[1]);
    $sec = evaluateGpsComponent($dms[2]);

    if ($deg === null) return null;

    $decimal = $deg + ($min / 60) + ($sec / 3600);

    if ($ref === 'S' || $ref === 'W') {
        $decimal *= -1;
    }

    return round($decimal, 7);
}

/**
 * Evaluate a GPS component (may be fraction like "35/1")
 */
function evaluateGpsComponent($value)
{
    if (is_numeric($value)) return (float)$value;
    if (is_string($value) && strpos($value, '/') !== false) {
        $parts = explode('/', $value);
        if (count($parts) === 2 && is_numeric($parts[0]) && is_numeric($parts[1]) && $parts[1] != 0) {
            return (float)$parts[0] / (float)$parts[1];
        }
    }
    return 0;
}

/**
 * FB-10: Strip EXIF metadata (including GPS) from images for privacy protection
 * Uses GD library to re-encode the image, which removes all metadata
 *
 * @param string $filepath Path to the image file
 * @return bool True if successful, false otherwise
 */
function stripExifData($filepath)
{
    if (!file_exists($filepath)) {
        return false;
    }

    if (!extension_loaded('gd')) {
        return true;
    }

    $imageInfo = getimagesize($filepath);
    if (!$imageInfo) {
        return false;
    }

    $mime = $imageInfo['mime'];
    $origWidth = (int)$imageInfo[0];
    $origHeight = (int)$imageInfo[1];

    switch ($mime) {
        case 'image/jpeg':
            $image = imagecreatefromjpeg($filepath);
            break;
        case 'image/png':
            $image = imagecreatefrompng($filepath);
            break;
        case 'image/webp':
            $image = imagecreatefromwebp($filepath);
            break;
        case 'image/gif':
            $image = imagecreatefromgif($filepath);
            break;
        default:
            return true;
    }

    if (!$image) {
        return false;
    }

    $maxDim = 1920;
    if ($origWidth > $maxDim || $origHeight > $maxDim) {
        $ratio = min($maxDim / $origWidth, $maxDim / $origHeight);
        $newWidth = max(1, (int)round($origWidth * $ratio));
        $newHeight = max(1, (int)round($origHeight * $ratio));
        $tmp = imagecreatetruecolor($newWidth, $newHeight);
        imagecopyresampled($tmp, $image, 0, 0, 0, 0, $newWidth, $newHeight, $origWidth, $origHeight);
        imagedestroy($image);
        $image = $tmp;
        $newW = $newWidth;
        $newH = $newHeight;
    } else {
        $newW = $origWidth;
        $newH = $origHeight;
    }

    // Flatten onto white background to remove alpha and enable lossy WebP encoding
    $flat = imagecreatetruecolor($newW, $newH);
    $white = imagecolorallocate($flat, 255, 255, 255);
    imagefill($flat, 0, 0, $white);
    imagecopy($flat, $image, 0, 0, 0, 0, $newW, $newH);
    imagedestroy($image);

    imagewebp($flat, $filepath, 82);
    imagedestroy($flat);
    return true;
}

function fetchRemoteFile(string $url, string $targetPath): bool
{
    $url = trim($url);
    if ($url === '') {
        return false;
    }

    $dir = dirname($targetPath);
    if (!is_dir($dir) && !mkdir($dir, 0777, true)) {
        return false;
    }

    $ch = curl_init($url);
    if ($ch === false) {
        return false;
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Accept: image/*'],
    ]);
    if (PHP_OS_FAMILY === 'Windows' && !ini_get('curl.cainfo')) {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    }
    $body = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    if (PHP_VERSION_ID < 80500) {
        curl_close($ch);
    }

    if ($body === false || $error !== '' || $httpCode >= 400 || $body === '') {
        return false;
    }

    return file_put_contents($targetPath, $body, LOCK_EX) !== false;
}

function buildPhotoMediaAssets(array $photos): array
{
    $assets = [];
    foreach ($photos as $index => $photoPath) {
        if (!is_string($photoPath) || $photoPath === '') {
            continue;
        }
        $assets[] = [
            'asset_id' => 'photo-' . ($index + 1),
            'provider' => 'local_upload',
            'media_type' => 'photo',
            'asset_role' => 'observation_photo',
            'media_path' => $photoPath,
            'thumbnail_url' => resolvePhotoThumbnailPath($photoPath, 'sm'),
            'upload_status' => 'ready',
            'source' => 'post_upload',
        ];
    }
    return $assets;
}

function resolvePhotoThumbnailPath(string $photoPath, string $suffix = 'sm'): string
{
    if (preg_match('#^(https?:)?//#i', $photoPath)) {
        return $photoPath;
    }

    return ThumbnailGenerator::resolve($photoPath, $suffix);
}

function buildVideoAssetFromRequest(string $observationId, array $post, string $actorId, string $observationDir): ?array
{
    $uid = trim((string)($post['stream_video_uid'] ?? ''));
    if ($uid === '') {
        return null;
    }

    $issuedUpload = DataStore::findById('system/cloudflare_stream_uploads', $uid);
    if (!is_array($issuedUpload) || (($issuedUpload['actor_id'] ?? '') !== $actorId)) {
        throw new RuntimeException('動画アップロードの検証に失敗しました。もう一度アップロードしてください。');
    }

    $videoDetails = [];
    try {
        $videoDetails = CloudflareStream::getVideo($uid);
    } catch (Throwable $e) {
        $videoDetails = [];
    }

    $asset = CloudflareStream::normalizeVideoRecord($uid, $videoDetails, [
        'duration_ms' => !empty($post['stream_video_duration_ms']) ? (int)$post['stream_video_duration_ms'] : null,
        'bytes' => !empty($post['stream_video_bytes']) ? (int)$post['stream_video_bytes'] : 0,
        'original_filename' => mb_substr(trim((string)($post['stream_video_filename'] ?? '')), 0, 180),
        'client_mime' => mb_substr(trim((string)($post['stream_video_mime'] ?? '')), 0, 80),
        'source' => 'direct_upload',
    ]);

    if (($asset['duration_ms'] ?? 0) > 15000) {
        throw new RuntimeException('動画は15秒以内で投稿してください。');
    }

    $posterRelativePath = 'uploads/photos/' . $observationId . '/video_poster.jpg';
    $posterAbsolutePath = PUBLIC_DIR . '/' . $posterRelativePath;
    if (fetchRemoteFile((string)($asset['thumbnail_url'] ?? ''), $posterAbsolutePath)) {
        $asset['poster_path'] = $posterRelativePath;
        $asset['poster_local'] = true;
    }

    DataStore::upsert('system/cloudflare_stream_uploads', [
        'id' => $uid,
        'uid' => $uid,
        'actor_id' => $actorId,
        'status' => 'attached',
        'observation_id' => $observationId,
        'updated_at' => date('c'),
        'video' => $asset,
    ], 'id');

    return $asset;
}

// Simple response helper
function respond($success, $message, $data = [])
{
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $data), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

function respondAndContinue($success, $message, $data = []): void
{
    $payload = json_encode(array_merge(['success' => $success, 'message' => $message], $data), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    if ($payload === false) {
        $payload = '{"success":false,"message":"response_encode_failed"}';
    }

    ignore_user_abort(true);
    if (function_exists('session_write_close')) {
        @session_write_close();
    }

    header('Content-Type: application/json; charset=utf-8');
    header('Connection: close');
    header('Content-Length: ' . strlen($payload));
    echo $payload;

    while (ob_get_level() > 0) {
        @ob_end_flush();
    }
    @flush();
    if (function_exists('fastcgi_finish_request')) {
        @fastcgi_finish_request();
    }
}

function isLightweightSubmission(array $post, array $photos, string $recordMode): bool
{
    if ($recordMode !== 'standard' || !empty($photos)) {
        return false;
    }

    $lightModeRequested = ($post['light_mode'] ?? '') === '1';
    $hasSubstance = trim((string)($post['taxon_name'] ?? '')) !== '' || trim((string)($post['note'] ?? '')) !== '';

    return $lightModeRequested && $hasSubstance;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Invalid request method');
}

// CSRF Check (Double-Submit Cookie pattern — no session dependency)
require_once __DIR__ . '/../../libs/CSRF.php';
if (!CSRF::validate($_POST['csrf_token'] ?? '')) {
    respond(false, 'セキュリティトークンが無効です。ページをリロードしてください。');
}

// Basic validation
$observed_at = $_POST['observed_at'] ?? '';
$lat = $_POST['lat'] ?? '';
$lng = $_POST['lng'] ?? '';
$cultivation = $_POST['cultivation'] ?? 'wild';
$organismOrigin = $_POST['organism_origin'] ?? '';
$biome = $_POST['biome'] ?? 'unknown'; // Phase 17
$note = $_POST['note'] ?? '';
$managedContext = ManagedSiteRegistry::normalizeObservationContext([
    'cultivation' => $cultivation,
    'organism_origin' => $organismOrigin,
    'managed_context_type' => $_POST['managed_context_type'] ?? null,
    'managed_site_id' => $_POST['managed_site_id'] ?? null,
    'managed_site_name' => $_POST['managed_site_name'] ?? null,
    'managed_context_note' => $_POST['managed_context_note'] ?? null,
]);
$organismOrigin = $managedContext['organism_origin'];
$recordMode = trim((string)($_POST['record_mode'] ?? 'standard'));
$allowedRecordModes = ['standard', 'surveyor_official'];
if (!in_array($recordMode, $allowedRecordModes, true)) {
    $recordMode = 'standard';
}

// 100-Year Archive Fusion: Substrate/Terrain Tags
$substrateTags = [];
$allowedSubstrates = ['rock', 'sand', 'gravel', 'grass', 'leaf_litter', 'deadwood', 'water', 'artificial'];
if (!empty($_POST['substrate_tags'])) {
    $decoded = json_decode($_POST['substrate_tags'], true);
    if (is_array($decoded)) {
        $substrateTags = array_values(array_intersect($decoded, $allowedSubstrates));
    }
}

// Data Quality: Evidence Tags (Morphological/Ecological)
$evidenceTags = [];
$allowedEvidence = ['color_pattern', 'shape', 'size', 'specific_part', 'behavior', 'habitat', 'host_plant', 'expert_id'];
if (!empty($_POST['evidence_tags'])) {
    $decoded = json_decode($_POST['evidence_tags'], true);
    if (is_array($decoded)) {
        $evidenceTags = array_values(array_intersect($decoded, $allowedEvidence));
    }
}

// Field Loop: satellite vs field mismatch note
$mismatch = isset($_POST['mismatch']) ? trim(substr($_POST['mismatch'], 0, 500)) : null;

// Individual Count (abundance reference indicator)
$individualCount = null;
if (isset($_POST['individual_count']) && $_POST['individual_count'] !== '') {
    $raw = (int)$_POST['individual_count'];
    if ($raw >= 1 && $raw <= 9999) {
        $individualCount = $raw;
    }
}

Auth::init();
$currentUser = Auth::user();
$isSurveyorOfficial = $recordMode === 'surveyor_official' && SurveyorManager::isApproved($currentUser);
if ($recordMode === 'surveyor_official' && !$isSurveyorOfficial) {
    respond(false, '調査員として承認されたアカウントのみ公式記録を作成できます。');
}

// Generate UUID v4 for observation (GBIF/DwC-A compatible persistent identifier)
$bytes = random_bytes(16);
$bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40); // version 4
$bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80); // variant RFC 4122
$id = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
$observation_dir = PUBLIC_DIR . '/uploads/photos/' . $id;

$photos = [];
$exifData = null; // FB-15: First photo's EXIF data

if (!empty($_FILES['photos'])) {
    if (!is_dir($observation_dir) && !mkdir($observation_dir, 0777, true)) {
        respond(false, 'フォルダの作成に失敗しました');
    }
    $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    $maxFileSize = 10 * 1024 * 1024; // 10MB per file
    $useFinfo = class_exists('finfo');
    $finfo = $useFinfo ? new finfo(FILEINFO_MIME_TYPE) : null;
    $file_count = count($_FILES['photos']['name']);
    for ($i = 0; $i < $file_count; $i++) {
        if ($_FILES['photos']['error'][$i] === UPLOAD_ERR_OK) {
            $tmp_name = $_FILES['photos']['tmp_name'][$i];

            // Security: Validate file size
            if ($_FILES['photos']['size'][$i] > $maxFileSize) {
                continue; // Skip oversized files silently
            }

            // Security: Validate MIME type from file content (preferred) or extension (fallback)
            if ($finfo) {
                $detectedMime = $finfo->file($tmp_name);
            } else {
                // Fallback: use extension-based MIME detection (less secure, but works without fileinfo ext)
                $extMap = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'];
                $fallbackExt = strtolower(pathinfo($_FILES['photos']['name'][$i], PATHINFO_EXTENSION));
                $detectedMime = $extMap[$fallbackExt] ?? 'application/octet-stream';
            }
            if (!in_array($detectedMime, $allowedMimes)) {
                continue; // Skip non-image files silently
            }

            $filename = 'photo_' . $i . '.webp';
            $target = $observation_dir . '/' . $filename;

            if (move_uploaded_file($tmp_name, $target)) {
                if ($i === 0) {
                    $exifData = extractExifData($target);
                }

                $stripped = stripExifData($target);
                if ($stripped) {
                    $photos[] = 'uploads/photos/' . $id . '/' . $filename;
                }
            }
        }
    }
}

// ゲスト投稿対応: ログイン済みならユーザーID、ゲストならセッション管理されたゲストID
if ($currentUser) {
    $userId = $currentUser['id'];
    $isGuestPost = false;
} else {
    // ゲストセッション初期化 & 投稿上限チェック
    Auth::initGuest();
    if (!Auth::canGuestPost()) {
        respond(false, 'ゲスト投稿の上限(' . Auth::GUEST_POST_LIMIT . '件)に達しました。ログインすると無制限に投稿できます。');
    }
    $userId = Auth::getGuestId();
    $isGuestPost = true;
}

$videoAsset = null;
try {
    $videoAsset = buildVideoAssetFromRequest($id, $_POST, $userId, $observation_dir);
} catch (Throwable $e) {
    respond(false, $e->getMessage());
}

if (empty($photos) && $videoAsset && !empty($videoAsset['poster_path'])) {
    $photos[] = $videoAsset['poster_path'];
}

if (empty($photos) && $videoAsset && empty($videoAsset['poster_path']) && !empty($videoAsset['thumbnail_url'])) {
    $photos[] = $videoAsset['thumbnail_url'];
}

$localPhotosForThumbs = array_values(array_filter(
    $photos,
    static fn($path) => is_string($path) && $path !== '' && !preg_match('#^(https?:)?//#i', $path)
));
if ($localPhotosForThumbs !== []) {
    ThumbnailGenerator::generateForObservation(['photos' => $localPhotosForThumbs]);
}

if (empty($photos) && $videoAsset === null && $recordMode !== 'surveyor_official') {
    if (!isLightweightSubmission($_POST, $photos, $recordMode)) {
        respond(false, '写真がアップロードされていません');
    }
}

// FB-15: Apply EXIF data as fallback values
// If user didn't provide observed_at but EXIF has a date, use it
if (empty($observed_at) && !empty($exifData['date'])) {
    $observed_at = $exifData['date'];
}

// FB-15: Apply EXIF GPS as fallback values
$exifLat = $exifData['lat'] ?? null;
$exifLng = $exifData['lng'] ?? null;

if ((empty($lat) || empty($lng)) && $exifLat !== null && $exifLng !== null) {
    $lat = $exifLat;
    $lng = $exifLng;
}

if (empty($lat) || empty($lng)) {
    // Clean up
    if (is_dir($observation_dir)) {
        foreach (glob($observation_dir . '/*') as $file) unlink($file);
        @rmdir($observation_dir);
    }
    respond(false, '位置情報が必要です（GPSを有効にするか、位置情報付きの写真をアップロードしてください）');
}

// Coordinate validation — reject invalid/suspicious coordinates
require_once __DIR__ . '/../../libs/GeoUtils.php';
$coordCheck = GeoUtils::validateCoordinates((float)$lat, (float)$lng);
if (!$coordCheck['valid']) {
    // Clean up
    if (is_dir($observation_dir)) {
        foreach (glob($observation_dir . '/*') as $file) unlink($file);
        @rmdir($observation_dir);
    }

    $reasons = [
        'out_of_range' => '座標が有効範囲外です',
        'null_island' => '位置情報が取得できていません（GPS を確認してください）',
        'polar_region' => '極地からの投稿はサポートされていません',
    ];
    respond(false, $reasons[$coordCheck['reason']] ?? '無効な座標です');
}

// Reverse geocode: lat/lng → country, prefecture, municipality
$geo = GeoUtils::reverseGeocode((float)$lat, (float)$lng);


// Phase 17: Biome Validation
require_once __DIR__ . '/../../libs/BiomeManager.php';
if (!BiomeManager::isValid($biome)) {
    $biome = 'unknown';
}

$biomeAutoSelected = !empty($_POST['biome_auto_selected']) && $_POST['biome_auto_selected'] === '1';
$biomeAutoReason = mb_substr(trim((string)($_POST['biome_auto_reason'] ?? '')), 0, 160);

if ($isSurveyorOfficial && empty($photos) && $videoAsset === null && trim((string)($_POST['taxon_name'] ?? '')) === '' && trim($note) === '') {
    respond(false, '写真なしの公式記録では、少なくとも種名かメモを入力してください。');
}

$observerDisplayName = $currentUser['name'] ?? null;
if ($observerDisplayName === $userId || preg_match('/^user_[a-z0-9]+$/i', (string)$observerDisplayName)) {
    $observerDisplayName = null;
}
$observerDisplayName = $observerDisplayName
    ?? $currentUser['display_name']
    ?? $currentUser['username']
    ?? ($isGuestPost ? 'Guest' : BioUtils::getUserName($userId));

// Check for Corporate Site Match
require_once __DIR__ . '/../../libs/CorporateSites.php';
$matchedSite = CorporateSites::findMatchingSite((float)$lat, (float)$lng);

$observation = [
    'id' => $id,
    'user_id' => $userId,
    'user_name' => $observerDisplayName,
    'user_display_name' => $observerDisplayName,
    'user_avatar' => $currentUser['avatar'] ?? 'https://i.pravatar.cc/150?u=' . $userId,
    'user_rank' => ($currentUser && !empty($currentUser['badges'])) ? end($currentUser['badges']) : 'Observer',
    'observed_at' => $observed_at ?: date('Y-m-d H:i'),
    'lat' => (float)$lat,
    'lng' => (float)$lng,
    'country' => $geo['country'],
    'prefecture' => $geo['prefecture'],
    'municipality' => $geo['municipality'],
    'cultivation' => $cultivation,
    'organism_origin' => $organismOrigin,
    'managed_context' => $managedContext['managed_context'],
    'life_stage' => $_POST['life_stage'] ?? 'unknown',
    'note' => $note,
    'photos' => $photos,
    'media_assets' => array_merge(
        buildPhotoMediaAssets($photos),
        $videoAsset ? [$videoAsset] : []
    ),
    'status' => 'Needs ID',
    'event_id' => !empty($_POST['event_id']) ? trim($_POST['event_id']) : null,
    'survey_id' => !empty($_POST['survey_id']) ? trim($_POST['survey_id']) : null,
    'site_id' => $matchedSite['id'] ?? null,
    'site_name' => $matchedSite['name'] ?? null,
    'created_at' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s'),
    'identifications' => [],
    'taxon' => null,
    'record_mode' => $isSurveyorOfficial ? 'surveyor_official' : 'standard',
    'official_record' => $isSurveyorOfficial,
    'light_mode' => isLightweightSubmission($_POST, $photos, $recordMode),
    'biome' => $biome, // Phase 17
    'biome_meta' => [
        'auto_selected' => $biomeAutoSelected,
        'source' => $biomeAutoSelected ? 'post_auto' : 'manual',
        'reason' => $biomeAutoSelected ? $biomeAutoReason : '',
        'updated_at' => date('c'),
    ],
    'substrate_tags' => $substrateTags ?: null, // 100-Year Archive Fusion
    'evidence_tags' => $evidenceTags ?: null, // Phase C M7: Data Quality
    'mismatch' => $mismatch ?: null, // Field Loop: satellite vs field reality
    'individual_count' => $individualCount, // Abundance reference indicator (DwC: individualCount)
    'archive_track' => ManagedSiteRegistry::isWildLike($organismOrigin) ? 'wild_occurrence' : 'managed_collection',
    // Phase A3: CC License (default CC BY — optimal for GBIF sharing)
    'license' => in_array($_POST['license'] ?? '', ['CC0', 'CC-BY', 'CC-BY-NC']) ? $_POST['license'] : 'CC-BY',
    // Phase A2: Data Quality Flags (auto-computed, recalculated on ID changes)
    'quality_flags' => [
        'has_media'    => !empty($photos) || $videoAsset !== null,
        'has_location' => !empty($lat) && !empty($lng),
        'has_date'     => !empty($observed_at),
        'is_organism'  => true, // Default true; future: AI validation
        'has_id'       => false, // Updated below if initial ID provided
        'is_wild'      => ManagedSiteRegistry::isWildLike($organismOrigin),
        'is_recent'    => (strtotime($observed_at ?: 'now') > strtotime('-1 year')),
        'ecological_verified' => !empty($_POST['ecological_verified']), // Phase 4 Validation
    ],
    // NP: GPS coordinate accuracy in meters (for DwC coordinateUncertaintyInMeters)
    'coordinate_accuracy' => !empty($_POST['coordinate_accuracy']) ? (int)$_POST['coordinate_accuracy'] : null,
    'location_granularity' => in_array($_POST['location_granularity'] ?? 'municipality', ['exact', 'municipality', 'prefecture', 'hidden']) ? ($_POST['location_granularity'] ?? 'municipality') : 'municipality',
];

if ($videoAsset !== null) {
    $observation['video_assets'] = [$videoAsset];
}

if ($isSurveyorOfficial) {
    $observation['official_source'] = [
        'type' => 'surveyor',
        'user_id' => $userId,
        'status' => SurveyorManager::getStatus($currentUser),
    ];
}

// FB-15: Store EXIF GPS as metadata if available (for data quality)
if ($exifLat !== null && $exifLng !== null) {
    $observation['exif_location'] = [
        'lat' => $exifLat,
        'lng' => $exifLng
    ];
}

// AI Assist: Store AI hint data for accuracy feedback loop
if (!empty($_POST['ai_hint'])) {
    $aiHint = json_decode($_POST['ai_hint'], true);
    if (is_array($aiHint) && !empty($aiHint['suggestions'])) {
        // Sanitize: only keep expected fields
        $cleanSuggestions = [];
        foreach (array_slice($aiHint['suggestions'], 0, 5) as $s) {
            $cleanSuggestions[] = [
                'label' => mb_substr(trim($s['label'] ?? ''), 0, 100),
                'emoji' => mb_substr($s['emoji'] ?? '', 0, 10),
                'confidence' => in_array($s['confidence'] ?? '', ['high', 'medium', 'low']) ? $s['confidence'] : 'low',
                'reason' => mb_substr(trim($s['reason'] ?? ''), 0, 200),
            ];
        }
        $selectedIndices = [];
        $selectedLabels = [];
        if (!empty($aiHint['selected_indices']) && is_array($aiHint['selected_indices'])) {
            $selectedIndices = array_map('intval', array_slice($aiHint['selected_indices'], 0, 5));
            $selectedLabels = array_map(
                fn($l) => mb_substr(trim($l), 0, 100),
                array_slice($aiHint['selected_labels'] ?? [], 0, 5)
            );
        }
        $observation['ai_hint'] = [
            'suggestions' => $cleanSuggestions,
            'processing_ms' => (int)($aiHint['processing_ms'] ?? 0),
            'asked_at' => date('Y-m-d H:i:s'),
            'selected_indices' => $selectedIndices,
            'selected_labels' => $selectedLabels,
        ];
    }
}

if (AiObservationAssessment::isConfigured()) {
    $observation['ai_assessment_status'] = 'queued';
}

// Initial Identification (if provided)
if (!empty($_POST['taxon_name'])) {
    $resolvedTaxon = Taxonomy::resolveFromInput([
        'taxon_name' => $_POST['taxon_name'] ?? '',
        'taxon_slug' => $_POST['taxon_slug'] ?? '',
        'taxon_rank' => $_POST['taxon_rank'] ?? 'species',
        'taxon_source' => $_POST['taxon_source'] ?? 'local',
        'inat_taxon_id' => $_POST['inat_taxon_id'] ?? null,
        'taxon_key' => $_POST['taxon_key'] ?? ($_POST['gbif_key'] ?? null),
    ]);

    $initial_id = [
        'id' => bin2hex(random_bytes(4)),
        'user_id' => $userId,
        'user_name' => $currentUser['name'] ?? 'Guest',
        'user_avatar' => $currentUser['avatar'] ?? 'https://i.pravatar.cc/150?u=' . $userId,
        'taxon_id' => $resolvedTaxon['taxon_id'],
        'taxon_provider' => $resolvedTaxon['provider'],
        'taxon_provider_id' => $resolvedTaxon['provider_id'],
        'taxon_key' => $resolvedTaxon['key'],
        'taxon_name' => $resolvedTaxon['name'],
        'taxon_slug' => $resolvedTaxon['slug'],
        'scientific_name' => $resolvedTaxon['scientific_name'],
        'taxon_rank' => $resolvedTaxon['rank'],
        'lineage' => $resolvedTaxon['lineage'],
        'lineage_ids' => $resolvedTaxon['lineage_ids'],
        'ancestry' => $resolvedTaxon['ancestry'],
        'ancestry_ids' => $resolvedTaxon['ancestry_ids'],
        'full_path_ids' => $resolvedTaxon['full_path_ids'],
        'taxonomy_version' => $resolvedTaxon['taxonomy_version'],
        'confidence' => 'menot', // "Probably"
        'life_stage' => $_POST['life_stage'] ?? 'unknown',
        'note' => '',
        'created_at' => date('Y-m-d H:i:s'),
        'weight' => 1.0,
        'weight_snapshot' => 1.0,
        'taxon' => Taxonomy::toObservationTaxon($resolvedTaxon),
    ];
    $observation['identifications'][] = $initial_id;
    // Update primary taxon immediately (expanded structure)
    $observation['taxon'] = Taxonomy::toObservationTaxon($resolvedTaxon);
    $observation['status'] = '要同定';
    $observation['quality_flags']['has_id'] = true;
    $observation['quality_flags']['has_lineage_conflict'] = false;
}

// Mark as user-generated content (protected from seed cleanup)
$observation['import_source'] = 'user_post';
// record_source: 3ソースを完全に区別するフィールド
$observation['record_source'] = 'post';

// Phase 15B P1: 外来種アラートチェック
$invasiveAlert = null;
if (!empty($_POST['taxon_name'])) {
    require_once __DIR__ . '/../../libs/InvasiveAlertManager.php';
    $scientificNameForCheck = '';
    if (!empty($resolvedTaxon['scientific_name'])) {
        $scientificNameForCheck = (string)$resolvedTaxon['scientific_name'];
    }
    $invasiveAlert = InvasiveAlertManager::check(
        (string)$_POST['taxon_name'],
        $scientificNameForCheck
    );
}

// Save to DataStore (partition by creation month, not observed_at)
if (DataStore::append('observations', $observation)) {
    $canonicalWrite = [
        'success' => false,
        'skipped' => !CANONICAL_DUAL_WRITE_ENABLED,
        'event_id' => null,
        'occurrence_id' => null,
        'error' => null,
    ];
    if (CANONICAL_DUAL_WRITE_ENABLED) {
        try {
            $canonicalResult = CanonicalObservationWriter::writeFromObservation($observation);
            $canonicalWrite['success'] = true;
            $canonicalWrite['skipped'] = !empty($canonicalResult['skipped']);
            $canonicalWrite['event_id'] = $canonicalResult['event_id'] ?? null;
            $canonicalWrite['occurrence_id'] = $canonicalResult['occurrence_id'] ?? null;

            DataStore::upsert('observations', [
                'id' => $id,
                'canonical_refs' => [
                    'event_id' => $canonicalWrite['event_id'],
                    'occurrence_id' => $canonicalWrite['occurrence_id'],
                    'synced_at' => date('c'),
                ],
            ]);
        } catch (\Throwable $e) {
            $canonicalWrite['error'] = $e->getMessage();
            error_log('Canonical dual-write failed for ' . $id . ': ' . $e->getMessage());
        }
    }

    ObservationRecalcQueue::enqueue($id, 'observation_created');
    $aiPlan = AiAssessmentQueue::planForObservation($observation, 'observation_created');
    // ゲスト投稿カウント更新
    if ($isGuestPost) {
        Auth::incrementGuestPostCount($id);
    }
    // Sync Gamification Stats if not guest
    $gamificationEvents = [];
    if ($currentUser) {
        Gamification::syncUserStats($userId, $gamificationEvents);
    }

    // 観察会V2: 自動集約フック — 投稿がアクティブな観察会エリア内か判定
    try {
        $obsLat = (float)$lat;
        $obsLng = (float)$lng;
        $obsTime = $observation['observed_at'] ?? date('Y-m-d H:i:s');
        $obsDate = substr($obsTime, 0, 10);

        $allEvents = DataStore::fetchAll('events');
        foreach ($allEvents as $evt) {
            if (($evt['status'] ?? '') !== 'open') continue;
            if (($evt['event_date'] ?? '') !== $obsDate) continue;

            $evtLat = (float)($evt['location']['lat'] ?? 0);
            $evtLng = (float)($evt['location']['lng'] ?? 0);
            $radiusM = (int)($evt['location']['radius_m'] ?? 500);
            if (!$evtLat || !$evtLng) continue;

            // Distance check
            $distM = GeoUtils::distance($evtLat, $evtLng, $obsLat, $obsLng);
            if ($distM > $radiusM) continue;

            // Time check (30min buffer)
            $startDT = new DateTime("{$obsDate} " . ($evt['start_time'] ?? '00:00'));
            $endDT = new DateTime("{$obsDate} " . ($evt['end_time'] ?? '23:59'));
            $startDT->modify('-30 minutes');
            $endDT->modify('+30 minutes');
            $obsDT = new DateTime($obsTime);
            if ($obsDT < $startDT || $obsDT > $endDT) continue;

            // Auto-link!
            $linked = $evt['linked_observations'] ?? [];
            if (!in_array($id, $linked)) {
                $linked[] = $id;
                $evt['linked_observations'] = $linked;
                $evt['updated_at'] = date('c');
                DataStore::upsert('events', $evt);
            }
        }
    } catch (Exception $e) {
        // 自動集約の失敗は投稿自体を妨げない
        error_log('Event auto-link error: ' . $e->getMessage());
    }

    // FB-15: Respond with EXIF info so frontend knows what was auto-filled
    $responseData = ['id' => $id];
    if (!empty($exifData['date'])) {
        $responseData['exif_date'] = $exifData['date'];
    }
    $embeddingPlanned = EmbeddingQueue::shouldQueueObservation($observation);

    if ($aiPlan !== null) {
        AiAssessmentQueue::enqueue($id, (string)$aiPlan['reason'], $aiPlan);
    }

    // Multi-subject: AI提案で複数選択された場合、追加subjectを作成
    $aiHintData = $observation['ai_hint'] ?? [];
    if (!empty($aiHintData['selected_indices']) && count($aiHintData['selected_indices']) > 1) {
        require_once __DIR__ . '/../../libs/SubjectHelper.php';
        SubjectHelper::ensureSubjects($observation);
        $selLabels = $aiHintData['selected_labels'] ?? [];
        for ($si = 1; $si < count($aiHintData['selected_indices']); $si++) {
            $label = $selLabels[$si] ?? '';
            if ($label !== '') {
                SubjectHelper::addSubject($observation, $label);
            }
        }
        SubjectHelper::syncPrimaryToLegacy($observation);
        DataStore::upsert('observations', $observation);
    }
    if ($embeddingPlanned) {
        EmbeddingQueue::enqueue($id, 'observation_created');
        DataStore::upsert('observations', [
            'id' => $id,
            'embedding_status' => 'queued',
            'embedding_updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    $responseData['ai_assessment_ready'] = false;
    $responseData['ai_assessment_pending'] = $aiPlan !== null;
    $responseData['embedding_pending'] = $embeddingPlanned;
    $responseData['canonical_write_success'] = $canonicalWrite['success'];
    $responseData['canonical_occurrence_id'] = $canonicalWrite['occurrence_id'];

    // Add Gamification Events to response
    if (!empty($gamificationEvents)) {
        $responseData['gamification_events'] = $gamificationEvents;
    }

    // Phase 15B P1: 外来種アラートをレスポンスに追加
    if ($invasiveAlert !== null) {
        $responseData['invasive_alert'] = $invasiveAlert;
    }

    StreakTracker::recordActivity($userId, 'post');
    AsyncJobMetrics::recordPostRequest([
        'observation_id' => $id,
        'duration_ms' => (int)round((microtime(true) - $requestStartedAt) * 1000),
        'ai_planned' => $aiPlan !== null,
        'embedding_planned' => $embeddingPlanned,
        'ai_queue' => AiAssessmentQueue::snapshot(),
        'embedding_queue' => EmbeddingQueue::snapshot(),
        'canonical_write_success' => $canonicalWrite['success'],
        'canonical_write_skipped' => $canonicalWrite['skipped'],
        'canonical_write_error' => $canonicalWrite['error'],
    ]);

    respondAndContinue(true, 'Observation posted successfully', $responseData);

    // Ecological Digital Twin: 気象コンテキスト非同期結合
    // respondAndContinue後なのでクライアントには遅延なし
    try {
        require_once __DIR__ . '/../../libs/WeatherContext.php';
        $weatherData = WeatherContext::getForObservation(
            (float)$lat,
            (float)$lng,
            $observation['observed_at']
        );
        if ($weatherData) {
            DataStore::upsert('observations', [
                'id' => $id,
                'weather_context' => $weatherData,
            ]);
        }
    } catch (Exception $e) {
        error_log('WeatherContext enrichment failed for ' . $id . ': ' . $e->getMessage());
    }

    exit;
} else {
    respond(false, 'データの保存に失敗しました');
}
