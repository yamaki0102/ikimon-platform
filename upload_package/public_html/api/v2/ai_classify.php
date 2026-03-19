<?php

/**
 * API v2: AI Species Classification (Realtime)
 *
 * ブラウザから写真を送信し、Gemini でリアルタイム種同定する。
 * スキャンモード（Web版）の核心エンドポイント。
 *
 * POST /api/v2/ai_classify.php
 * Content-Type: multipart/form-data
 *   photo: 写真ファイル (JPEG/PNG/WebP)
 *   lat: (optional) 緯度
 *   lng: (optional) 経度
 *
 * Response:
 *   { success: true, data: { suggestions: [{name, scientific_name, confidence, rank}] } }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/AiObservationAssessment.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Authentication required.', 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST method required.', 405);
}

// レート制限（AI推論はコストがかかるので厳しめ）
if (!api_rate_limit('ai_classify', 10, 60)) {
    api_error('Rate limit exceeded. Max 10 classifications per minute.', 429);
}

// Gemini API 設定チェック
if (!AiObservationAssessment::isConfigured()) {
    api_error('AI classification is not configured on this server.', 503);
}

// 写真の受け取り
$photoFile = $_FILES['photo'] ?? null;
if (!$photoFile || $photoFile['error'] !== UPLOAD_ERR_OK) {
    api_error('Photo file is required.', 400);
}

// MIME チェック
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($photoFile['tmp_name']);
if (!in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp'], true)) {
    api_error('Invalid file type. Must be JPEG, PNG, or WebP.', 400);
}

// ファイルサイズ制限（10MB）
if ($photoFile['size'] > 10 * 1024 * 1024) {
    api_error('File too large. Max 10MB.', 400);
}

$lat = isset($_POST['lat']) ? (float) $_POST['lat'] : null;
$lng = isset($_POST['lng']) ? (float) $_POST['lng'] : null;

// 一時的な観察オブジェクトを構築して AI 推論
$tmpDir = sys_get_temp_dir() . '/ikimon_classify_' . bin2hex(random_bytes(4));
@mkdir($tmpDir, 0755);

$ext = match ($mimeType) {
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    default => 'jpg',
};
$tmpPhoto = $tmpDir . '/photo.' . $ext;
move_uploaded_file($photoFile['tmp_name'], $tmpPhoto);

$observation = [
    'id' => 'classify_' . bin2hex(random_bytes(4)),
    'photos' => [['path' => $tmpPhoto, 'url' => $tmpPhoto]],
    'lat' => $lat,
    'lng' => $lng,
    'observed_at' => date('Y-m-d H:i:s'),
];

try {
    $assessment = AiObservationAssessment::buildAssessmentForObservation($observation, [
        'lane' => 'fast',
    ]);

    // 一時ファイル削除
    @unlink($tmpPhoto);
    @rmdir($tmpDir);

    if (!$assessment) {
        api_error('Classification failed. Please try again.', 500);
    }

    // レスポンス整形
    $suggestions = [];
    foreach ($assessment['top_suggestions'] ?? [] as $sug) {
        $suggestions[] = [
            'name' => $sug['name'] ?? '',
            'scientific_name' => $sug['scientific_name'] ?? '',
            'confidence' => $sug['confidence'] ?? 0,
            'rank' => $sug['rank'] ?? 'species',
        ];
    }

    // トップ候補がない場合は assessment から取得を試みる
    if (empty($suggestions) && !empty($assessment['taxon_name'])) {
        $suggestions[] = [
            'name' => $assessment['taxon_name'],
            'scientific_name' => $assessment['scientific_name'] ?? '',
            'confidence' => $assessment['confidence'] ?? 0,
            'rank' => $assessment['taxon_rank'] ?? 'species',
        ];
    }

    api_success([
        'suggestions' => $suggestions,
        'model' => $assessment['model'] ?? 'unknown',
        'processing_lane' => 'fast',
    ]);

} catch (\Throwable $e) {
    @unlink($tmpPhoto);
    @rmdir($tmpDir);
    api_error('Classification error: ' . $e->getMessage(), 500);
}
