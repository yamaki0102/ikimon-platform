<?php

/**
 * API v2: Scan Classify — ライブスキャン専用の貪欲な種検出
 *
 * ai_classify.php（投稿用・慎重）とは別に、
 * ライブスキャンでは「映ってるもの全部」をなるべく多く返す。
 *
 * POST /api/v2/scan_classify.php
 *   - photo: JPEG画像
 *   - lat, lng: GPS座標（任意）
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Unauthorized', 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST required', 405);
}

if (!api_rate_limit('scan_classify', 30, 60)) {
    api_error('Rate limit exceeded', 429);
}

if (!defined('GEMINI_API_KEY') || !GEMINI_API_KEY) {
    api_error('AI not configured', 503);
}

if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    api_error('No photo', 400);
}

$imageData = file_get_contents($_FILES['photo']['tmp_name']);
$base64 = base64_encode($imageData);
$lat = floatval($_POST['lat'] ?? 0);
$lng = floatval($_POST['lng'] ?? 0);

$contextBlock = '';
$context = isset($_POST['context']) ? json_decode($_POST['context'], true) : null;
if (is_array($context)) {
    $parts = [];
    if (!empty($context['environment'])) {
        $env = $context['environment'];
        $envLine = '環境: ';
        $envParts = [];
        if (!empty($env['habitat'])) $envParts[] = $env['habitat'];
        if (!empty($env['vegetation'])) $envParts[] = $env['vegetation'];
        if (!empty($env['canopy_cover'])) $envParts[] = '林冠被覆' . $env['canopy_cover'] . '%';
        if (!empty($env['water']) && $env['water'] !== 'なし') $envParts[] = '水系: ' . $env['water'];
        if ($envParts) $parts[] = $envLine . implode('、', $envParts);
    }
    if (!empty($context['recent_detections']) && is_array($context['recent_detections'])) {
        $dets = array_slice($context['recent_detections'], 0, 8);
        $detStrs = array_map(function($d) {
            $name = $d['name'] ?? '';
            $conf = isset($d['confidence']) ? number_format($d['confidence'], 2) : '?';
            return $name . '(' . $conf . ')';
        }, $dets);
        if ($detStrs) $parts[] = '直近の検出: ' . implode(', ', $detStrs);
    }
    if ($parts) {
        $contextBlock = "\n\n【スキャン文脈】\n" . implode("\n", $parts) . "\nこの環境と直近の検出結果を参考に、同定の精度を高めてください。既に検出された種が再度映っている場合は同じ名前で統一してください。\n";
    }
}

$prompt = <<<PROMPT
写真の生物を全て列挙。植物・動物・菌類が対象。人間・人工物・地面・空は除外。
確信度低くてもOK。植栽・街路樹も含む。映っている生物は全て記録する。

命名ルール（具体的に）:
- 種がわかれば和名（例: ソメイヨシノ、スズメ）
- 科や属まで（例: イネ科の草本、キク科の多年草）
- 形態レベルでもOK（例: 常緑広葉樹、落葉高木、つる性植物、ロゼット型草本）
- 「草」「木」の1語だけは禁止。「常緑広葉樹」「落葉低木」等は歓迎

noteフィールド = 初めて見た人が「へぇ！」と思う豆知識1文。例:
- 動物: 「水辺のハンター、ホバリングからダイブで魚を捕る」「日本最小のキツツキ」
- 植物種: 「春に最初に咲く桜の代表品種」「秋に紅葉する落葉樹の代表格」
- 植生レベル: 「森の骨格を作り夏に日陰を提供する」「土壌を固定し崖崩れを防ぐ」
{$contextBlock}
JSON配列のみ出力:
[{"name":"和名","scientific_name":"学名","confidence":0.0-1.0,"category":"plant/bird/insect/mammal/fungus/other","note":"へぇポイント1文"}]
生物なしなら[]。
PROMPT;

$model = 'gemini-3.1-flash-lite-preview';
$url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':generateContent?key=' . GEMINI_API_KEY;

$payload = [
    'contents' => [[
        'parts' => [
            ['text' => $prompt],
            ['inline_data' => ['mime_type' => 'image/jpeg', 'data' => $base64]],
        ],
    ]],
    'generationConfig' => [
        'temperature' => 0.2,
        'maxOutputTokens' => 400,
    ],
];

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 8,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$response) {
    api_error('AI error', 502);
}

$result = json_decode($response, true);
$text = $result['candidates'][0]['content']['parts'][0]['text'] ?? '';

// JSON 抽出
$text = preg_replace('/^```json\s*/', '', trim($text));
$text = preg_replace('/```$/', '', trim($text));
$suggestions = json_decode($text, true);

if (!is_array($suggestions)) {
    $suggestions = [];
}

// confidence でソート
usort($suggestions, function($a, $b) {
    return ($b['confidence'] ?? 0) <=> ($a['confidence'] ?? 0);
});

api_success([
    'suggestions' => $suggestions,
    'count'       => count($suggestions),
    'model'       => $model,
]);
