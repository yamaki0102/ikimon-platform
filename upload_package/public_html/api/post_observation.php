<?php
header('Content-Type: application/json');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/RateLimiter.php';

// FB-12: Apply rate limiting
RateLimiter::check();

/**
 * FB-10: Strip EXIF metadata (including GPS) from images for privacy protection
 * Uses GD library to re-encode the image, which removes all metadata
 * 
 * @param string $filepath Path to the image file
 * @return bool True if successful, false otherwise
 */
function stripExifData($filepath) {
    if (!file_exists($filepath)) {
        return false;
    }
    
    $imageInfo = getimagesize($filepath);
    if (!$imageInfo) {
        return false;
    }
    
    $mime = $imageInfo['mime'];
    
    // Create image resource based on type
    switch ($mime) {
        case 'image/jpeg':
            $image = imagecreatefromjpeg($filepath);
            if ($image) {
                // Re-save without EXIF (quality 90)
                imagejpeg($image, $filepath, 90);
                imagedestroy($image);
                return true;
            }
            break;
        case 'image/png':
            $image = imagecreatefrompng($filepath);
            if ($image) {
                // Preserve transparency
                imagesavealpha($image, true);
                imagepng($image, $filepath, 9);
                imagedestroy($image);
                return true;
            }
            break;
        case 'image/webp':
            $image = imagecreatefromwebp($filepath);
            if ($image) {
                imagewebp($image, $filepath, 90);
                imagedestroy($image);
                return true;
            }
            break;
        case 'image/gif':
            // GIF usually doesn't have EXIF, but re-encode anyway
            $image = imagecreatefromgif($filepath);
            if ($image) {
                imagegif($image, $filepath);
                imagedestroy($image);
                return true;
            }
            break;
        default:
            // Unknown format, keep as is
            return true;
    }
    
    return false;
}

// Simple response helper
function respond($success, $message, $data = []) {
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $data));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Invalid request method');
}

// CSRF Check
require_once __DIR__ . '/../../libs/CSRF.php';
if (!CSRF::validate($_POST['csrf_token'] ?? '')) {
    respond(false, 'セッションが無効です。ページをリロードしてください。');
}

// Basic validation
$observed_at = $_POST['observed_at'] ?? '';
$lat = $_POST['lat'] ?? '';
$lng = $_POST['lng'] ?? '';
$cultivation = $_POST['cultivation'] ?? 'wild';
$note = $_POST['note'] ?? '';

if (empty($lat) || empty($lng)) {
    respond(false, '位置情報が必要です');
}

// Generate unique ID for observation
$id = bin2hex(random_bytes(8));
$observation_dir = PUBLIC_DIR . '/uploads/photos/' . $id;
if (!mkdir($observation_dir, 0777, true)) {
    respond(false, 'フォルダの作成に失敗しました');
}

$photos = [];
if (!empty($_FILES['photos'])) {
    $file_count = count($_FILES['photos']['name']);
    for ($i = 0; $i < $file_count; $i++) {
        if ($_FILES['photos']['error'][$i] === UPLOAD_ERR_OK) {
            $tmp_name = $_FILES['photos']['tmp_name'][$i];
            $ext = pathinfo($_FILES['photos']['name'][$i], PATHINFO_EXTENSION) ?: 'webp';
            $filename = 'photo_' . $i . '.' . $ext;
            $target = $observation_dir . '/' . $filename;
            
            if (move_uploaded_file($tmp_name, $target)) {
                // FB-10: Strip EXIF data (including GPS) for privacy protection
                // Re-encode the image using GD to remove all metadata
                $stripped = stripExifData($target);
                if ($stripped) {
                    $photos[] = 'uploads/photos/' . $id . '/' . $filename;
                }
            }
        }
    }
}

if (empty($photos)) {
    respond(false, '写真がアップロードされていません');
}

// Prepare observation data
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/Gamification.php';

$currentUser = Auth::user();
$userId = $currentUser['id'] ?? ('guest_' . bin2hex(random_bytes(4)));

// Check for Corporate Site Match
require_once __DIR__ . '/../../libs/CorporateSites.php';
$matchedSite = CorporateSites::findMatchingSite((float)$lat, (float)$lng);

$observation = [
    'id' => $id,
    'user_id' => $userId,
    'user_name' => $currentUser['name'] ?? 'Guest',
    'user_avatar' => $currentUser['avatar'] ?? 'https://i.pravatar.cc/150?u=' . $userId,
    'user_rank' => ($currentUser && !empty($currentUser['badges'])) ? end($currentUser['badges']) : 'Observer',
    'observed_at' => $observed_at ?: date('Y-m-d H:i'),
    'lat' => (float)$lat,
    'lng' => (float)$lng,
    'cultivation' => $cultivation,
    'life_stage' => $_POST['life_stage'] ?? 'unknown', // New field
    'note' => $note,
    'photos' => $photos,
    'status' => 'Needs ID',
    'site_id' => $matchedSite['id'] ?? null,    // Auto-matched business site
    'site_name' => $matchedSite['name'] ?? null,
    'created_at' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s'),
    'identifications' => [],
    'taxon' => null
];

// Initial Identification (if provided)
if (!empty($_POST['taxon_name'])) {
    $initial_id = [
        'id' => bin2hex(random_bytes(4)),
        'user_id' => $userId,
        'user_name' => $currentUser['name'] ?? 'Guest',
        'user_avatar' => $currentUser['avatar'] ?? 'https://i.pravatar.cc/150?u=' . $userId,
        'taxon_name' => $_POST['taxon_name'],
        'scientific_name' => '', // Navigator might provide this in future updates
        'confidence' => 'menot', // "Probably"
        'life_stage' => $_POST['life_stage'] ?? 'unknown',
        'note' => '',
        'created_at' => date('Y-m-d H:i:s'),
        'weight' => 1.0
    ];
    $observation['identifications'][] = $initial_id;
    // Update primary taxon immediately
    $observation['taxon'] = [
        'id' => null, // No GBIF ID yet
        'name' => $_POST['taxon_name'],
        'scientific_name' => ''
    ];
    $observation['status'] = 'Needs ID'; // Keep as Needs ID until confirmed by others? Or "Research Grade"? 
    // Logic: If user suggests it, it's a proposal.
}

// Save to DataStore
if (DataStore::upsert('observations', $observation)) {
    // Sync Gamification Stats if not guest
    if ($currentUser) {
        Gamification::syncUserStats($userId);
    }
    respond(true, 'Observation posted successfully', ['id' => $id]);
} else {
    respond(false, 'データの保存に失敗しました');
}
