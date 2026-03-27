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

// GeoContext: OSM/地理データから環境文脈を取得
$geoContextLine = '';
if ($lat && $lng) {
    try {
        require_once ROOT_DIR . '/libs/GeoContext.php';
        $geoContextLine = GeoContext::getPromptContext($lat, $lng);
    } catch (Throwable $e) {
        error_log("[scan_classify] GeoContext error: " . $e->getMessage());
    }
}

$context = isset($_POST['context']) ? json_decode($_POST['context'], true) : null;
if (is_array($context) || $geoContextLine) {
    $parts = [];
    if ($geoContextLine) $parts[] = $geoContextLine;
    if (is_array($context) && !empty($context['environment'])) {
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
        $contextBlock = "\n\n【スキャン文脈（補助情報のみ）】\n" . implode("\n", $parts) . "\n※この文脈は補助情報です。必ず今の写真に実際に写っているものだけを答えてください。直近の検出種が写っていない場合は含めないでください。\n";
    }
}

$prompt = <<<PROMPT
写真にはっきり写っている生物を列挙してください。植物・動物・菌類が対象。人間・人工物・地面・空・背景のぼかしは除外。

厳守ルール:
- 確信度0.5未満の生物は絶対に含めない
- 写真がぼやけている・小さすぎて判別不能な場合は[]を返す
- 実際に写真に写っているものだけを答える（推測・想像は禁止）
- 1枚の写真から通常5種以上は検出されない。多すぎる場合は確信度の高いものに絞る

命名ルール:
- 種がわかれば和名（例: ソメイヨシノ、スズメ、カラス）
- 科や属まで（例: イネ科の草本、キク科の多年草）
- 形態レベル可（例: 常緑広葉樹、落葉高木）
- 「草」「木」の1語のみは禁止
{$contextBlock}
noteフィールド = 初めて見た人が「へぇ！」と思う豆知識1文（実際に写真に写っている生物についてのみ）。

higher_group = 鳥類/植物/昆虫/哺乳類/爬虫類/両生類/魚類/クモ類/菌類/コケ・地衣類/その他 の中から1つ。

JSON配列のみ出力（余計なテキスト禁止）:
[{"name":"和名","scientific_name":"学名","confidence":0.5-1.0,"category":"plant/bird/insect/mammal/fungus/other","higher_group":"鳥類など","family":"科名(不明なら空)","genus":"属名(不明なら空)","note":"豆知識1文"}]
生物が写っていない・判別できない場合は[]。
PROMPT;

$model = 'gemini-2.5-flash';
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
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_CONNECTTIMEOUT => 5,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($httpCode === 429) {
    api_error('AI rate limit', 429);
}
if ($httpCode !== 200 || !$response) {
    error_log("[scan_classify] Gemini error: HTTP {$httpCode}, curl: {$curlError}");
    api_error('AI temporarily unavailable', 503);
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

// 信頼度フィルタ（0.60未満を除外 — 試験運用: 精度重視）
$suggestions = array_filter($suggestions, function($s) {
    return ($s['confidence'] ?? 0) >= 0.60;
});
$suggestions = array_values($suggestions);

// confidence でソート
usort($suggestions, function($a, $b) {
    return ($b['confidence'] ?? 0) <=> ($a['confidence'] ?? 0);
});

// 上位8件のみ
$suggestions = array_slice($suggestions, 0, 8);

// confidence_label 付与（データ品質の可視化）
foreach ($suggestions as &$sug) {
    $c = $sug['confidence'] ?? 0;
    $sug['confidence_label'] = $c >= 0.85 ? 'high' : ($c >= 0.70 ? 'moderate' : 'low');
    $sug['is_experimental'] = true;
}
unset($sug);

api_success([
    'suggestions' => $suggestions,
    'count'       => count($suggestions),
    'model'       => $model,
    'mode'        => 'experimental',
]);
