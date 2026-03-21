<?php

/**
 * API v2: Environment Scan — 環境コンテキスト分析
 *
 * カメラフレームから周囲の環境を Gemini AI で記述する。
 * 種同定ではなく、ハビタット・植生・地形・構造物を分析。
 *
 * POST /api/v2/env_scan.php
 *   - photo: 画像ファイル (JPEG)
 *   - lat: 緯度
 *   - lng: 経度
 *
 * レスポンス:
 *   { success: true, data: { environment: { habitat, vegetation, ground, water, structures, description } } }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Unauthorized', 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('Method not allowed', 405);
}

if (!api_rate_limit('env_scan', 10, 60)) {
    api_error('Rate limit exceeded', 429);
}

if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    api_error('No photo', 400);
}

if (!defined('GEMINI_API_KEY') || !GEMINI_API_KEY) {
    api_error('AI service not configured', 503);
}

$lat = floatval($_POST['lat'] ?? 0);
$lng = floatval($_POST['lng'] ?? 0);

// 画像を読み込み
$imageData = file_get_contents($_FILES['photo']['tmp_name']);
$base64 = base64_encode($imageData);

// Gemini に環境分析を依頼
$prompt = "この写真の撮影場所の自然環境を分析してください。種の同定ではなく、環境・ハビタットの記述です。\n\n"
    . "以下のJSON形式で回答してください（日本語）:\n"
    . "{\n"
    . "  \"habitat\": \"環境タイプ（例: 落葉広葉樹林, 河川敷, 都市公園, 水田, 草地, 海岸 等）\",\n"
    . "  \"vegetation\": \"植生の状態（例: 高木層あり・下草豊富, 芝生のみ, 裸地 等）\",\n"
    . "  \"ground\": \"地面の状態（例: 落ち葉, 土壌露出, 舗装, 砂利 等）\",\n"
    . "  \"water\": \"水系（例: 小川あり, 池, なし, 側溝 等）\",\n"
    . "  \"structures\": \"人工構造物（例: ベンチ, フェンス, 遊歩道, なし 等）\",\n"
    . "  \"canopy_cover\": \"林冠被覆率の推定（0-100%）\",\n"
    . "  \"disturbance\": \"撹乱度（low/medium/high）\",\n"
    . "  \"description\": \"50字以内の総合的な環境記述\"\n"
    . "}\n\nJSONのみ出力してください。";

$model = 'gemini-2.5-flash-lite';
$url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':generateContent?key=' . GEMINI_API_KEY;

$payload = [
    'contents' => [[
        'parts' => [
            ['text' => $prompt],
            ['inline_data' => [
                'mime_type' => 'image/jpeg',
                'data' => $base64,
            ]],
        ],
    ]],
    'generationConfig' => [
        'temperature' => 0.2,
        'maxOutputTokens' => 300,
    ],
];

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$response) {
    api_error('AI service error', 502);
}

$result = json_decode($response, true);
$text = $result['candidates'][0]['content']['parts'][0]['text'] ?? '';

// JSON を抽出（コードブロックの場合）
$text = preg_replace('/^```json\s*/', '', trim($text));
$text = preg_replace('/```$/', '', trim($text));

$env = json_decode($text, true);
if (!$env) {
    // パース失敗 → テキストとして返す
    $env = ['description' => $text, 'raw' => true];
}

// 座標を付与
$env['lat'] = $lat;
$env['lng'] = $lng;
$env['timestamp'] = date('c');

api_success(['environment' => $env]);
