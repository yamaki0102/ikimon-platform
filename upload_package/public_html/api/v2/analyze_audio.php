<?php

/**
 * API v2: Audio Analysis Bridge
 *
 * ブラウザから受け取った音声スニペットを VPS 上の BirdNET FastAPI サービスに転送し、
 * 鳥種判定結果を返す。
 *
 * POST /api/v2/analyze_audio.php
 *   - audio: 音声ファイル (webm/mp4/wav, max 5MB)
 *   - lat:   緯度 (float)
 *   - lng:   経度 (float)
 *
 * レスポンス:
 *   { success: true, data: { detections: [...] } }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';

// --- Method check ---
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('Method not allowed', 405);
}

// --- Auth ---
Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Unauthorized', 401);
}

// --- Rate limit: 20 req/min (3秒間隔のリアルタイム分析に対応) ---
if (!api_rate_limit('analyze_audio', 20, 60)) {
    api_error('Rate limit exceeded. Try again in a moment.', 429);
}

// --- Audio file validation ---
if (!isset($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
    api_error('No audio file or upload error', 400);
}

$file = $_FILES['audio'];

// サイズチェック (5MB)
if ($file['size'] > 5 * 1024 * 1024) {
    api_error('Audio file too large (max 5MB)', 413);
}

// MIME タイプチェック（許容: webm, mp4, wav, ogg）
$allowedMimes = [
    'audio/webm',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/ogg',
    'audio/mpeg',
    'video/webm',  // Chrome が audio/webm の代わりにこれを送ることがある
];

$finfo = new finfo(FILEINFO_MIME_TYPE);
$detectedMime = $finfo->file($file['tmp_name']);

if (!in_array($detectedMime, $allowedMimes, true)) {
    api_error("Unsupported audio format: {$detectedMime}", 415);
}

// --- Parameters ---
$lat = isset($_POST['lat']) ? floatval($_POST['lat']) : 35.0;
$lng = isset($_POST['lng']) ? floatval($_POST['lng']) : 139.0;

// 座標の妥当性チェック
if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
    api_error('Invalid coordinates', 400);
}

// --- Forward to FastAPI BirdNET service ---
$birdnetUrl = 'http://127.0.0.1:8100/analyze';

$cfile = new CURLFile(
    $file['tmp_name'],
    $detectedMime,
    'snippet' . _audioExtension($detectedMime)
);

$ch = curl_init($birdnetUrl);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => [
        'audio'    => $cfile,
        'lat'      => $lat,
        'lng'      => $lng,
        'min_conf' => 0.10,
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_CONNECTTIMEOUT => 3,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

// --- Handle response ---
if ($curlError) {
    error_log("[analyze_audio] cURL error: {$curlError}");
    api_error('AI service temporarily unavailable', 503);
}

if ($httpCode !== 200) {
    error_log("[analyze_audio] BirdNET returned HTTP {$httpCode}: " . substr($response, 0, 500));
    api_error('AI service error', 502);
}

$result = json_decode($response, true);
if (!$result || !isset($result['detections'])) {
    error_log("[analyze_audio] Invalid BirdNET response: " . substr($response, 0, 500));
    api_error('Invalid AI response', 502);
}

// --- Save audio evidence if detections found ---
$audioPath = null;
if (!empty($result['detections'])) {
    $audioPath = _saveAudioEvidence($file, $detectedMime);
    if ($audioPath) {
        $result['audio_evidence_path'] = $audioPath;
        // SHA-256 ハッシュ（100年耐久: データ完全性検証用）
        $fullPath = PUBLIC_DIR . '/' . $audioPath;
        if (file_exists($fullPath)) {
            $result['audio_hash'] = hash_file('sha256', $fullPath);
        }
    }
}

// --- Return detections ---
api_success($result);


// --- Helpers ---

/**
 * 検出がある音声スニペットを保存（証拠保全）
 *
 * @return string|null 保存先の相対パス（public_html/ からの相対）
 */
function _saveAudioEvidence(array $file, string $mime): ?string
{
    $yearMonth = date('Y-m');
    $dir = PUBLIC_DIR . "/uploads/audio/{$yearMonth}";
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    $ext = _audioExtension($mime);
    $filename = uniqid('audio_', true) . $ext;
    $destPath = "{$dir}/{$filename}";

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        // tmp_name が既に消費されている場合（cURL送信後）はコピーを試みる
        if (!copy($file['tmp_name'], $destPath)) {
            return null;
        }
    }

    return "uploads/audio/{$yearMonth}/{$filename}";
}

/**
 * MIME タイプから拡張子を推定
 */
function _audioExtension(string $mime): string
{
    return match ($mime) {
        'audio/webm', 'video/webm' => '.webm',
        'audio/mp4'                => '.mp4',
        'audio/wav', 'audio/x-wav', 'audio/wave' => '.wav',
        'audio/ogg'                => '.ogg',
        'audio/mpeg'               => '.mp3',
        default                    => '.webm',
    };
}
