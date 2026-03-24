<?php
/**
 * analyze_audio_perch.php — Perch v2 音声分析ブリッジ
 *
 * ブラウザから音声スニペットを受け取り、VPS上の Perch v2 FastAPI に転送。
 * BirdNET (CC BY-NC-SA) の代替。Perch v2 は Apache 2.0。
 *
 * POST /api/v2/analyze_audio_perch.php
 *   - audio: 音声ファイル (webm/mp4/wav, max 5MB)
 *   - lat: 緯度 (float)
 *   - lng: 経度 (float)
 *
 * レスポンス:
 *   { success: true, data: { detections: [{scientific_name, common_name, japanese_name, confidence}] } }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('Method not allowed', 405);
}

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Unauthorized', 401);
}

if (!api_rate_limit('analyze_audio_perch', 20, 60)) {
    api_error('Rate limit exceeded', 429);
}

if (!isset($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
    api_error('No audio file', 400);
}

$file = $_FILES['audio'];
if ($file['size'] > 5 * 1024 * 1024) {
    api_error('Audio too large (max 5MB)', 413);
}

$lat = (float)($_POST['lat'] ?? 35.0);
$lng = (float)($_POST['lng'] ?? 139.0);

// Perch v2 FastAPI エンドポイント（同一VPS上で動作）
$perchUrl = 'http://127.0.0.1:8765/classify';

$cfile = new CURLFile($file['tmp_name'], $file['type'] ?: 'audio/webm', $file['name'] ?: 'audio.webm');

$ch = curl_init($perchUrl);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => [
        'file' => $cfile,
        'lat' => $lat,
        'lng' => $lng,
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_CONNECTTIMEOUT => 5,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($response === false || $httpCode !== 200) {
    // Perch v2 サービスが未起動 or エラー
    json_response([
        'success' => true,
        'data' => [
            'detections' => [],
            'engine' => 'perch_v2',
            'status' => 'service_unavailable',
            'message' => 'Perch v2 サービスに接続できません。音声種同定は一時的に利用不可です。',
        ]
    ]);
    exit;
}

$result = json_decode($response, true);

if (!$result || !isset($result['results'])) {
    json_response([
        'success' => true,
        'data' => ['detections' => [], 'engine' => 'perch_v2']
    ]);
    exit;
}

// Perch v2 の出力を ikimon.life 形式に変換
$detections = [];
foreach ($result['results'] as $segment) {
    foreach ($segment['predictions'] ?? [] as $pred) {
        if (($pred['confidence'] ?? 0) < 0.1) continue;
        $detections[] = [
            'scientific_name' => $pred['species'] ?? '',
            'common_name' => $pred['common_name'] ?? $pred['species'] ?? '',
            'japanese_name' => $pred['japanese_name'] ?? null,
            'confidence' => (float)($pred['confidence'] ?? 0),
            'engine' => 'perch_v2',
        ];
    }
}

// 確信度でソート、上位5件
usort($detections, function ($a, $b) {
    return $b['confidence'] <=> $a['confidence'];
});
$detections = array_slice($detections, 0, 5);

json_response([
    'success' => true,
    'data' => [
        'detections' => $detections,
        'engine' => 'perch_v2',
        'segments_analyzed' => count($result['results']),
    ]
]);
