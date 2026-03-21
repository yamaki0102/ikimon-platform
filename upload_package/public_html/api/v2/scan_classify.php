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

$prompt = <<<'PROMPT'
この写真に映っている「生きている生物」のみを列挙してください。

対象:
- 植物（樹木、草、花、苔、シダ、地衣類、藻類）
- 動物（鳥、昆虫、哺乳類、爬虫類、両生類、クモ）
- 菌類（キノコ）

対象外（絶対に含めないで）:
- 地面、土、砂利、石、岩
- レンガ、コンクリート、アスファルト、タイル
- 建物、フェンス、ベンチ、電柱などの人工構造物
- 水たまり、空、雲

確信度が低くてもOK。「〜に見える」「〜かもしれない」レベルで構いません。
植栽の街路樹や庭の花も対象です。

重要な命名ルール:
- 「雑草」「草」「木」のような雑な名前は絶対に使わないでください
- 種名がわかれば和名で（例: オオバコ、エノコログサ、シロツメクサ）
- 種名がわからなければ科や属で（例: イネ科の草本、キク科の多年草、マメ科の植物）
- それでも難しければ形態で（例: ロゼット型の草本、つる性植物、常緑広葉樹）
- すべての生き物に敬意を持った名前をつけてください

JSON配列で回答:
[
  {"name": "和名", "scientific_name": "学名（わかれば空文字）", "confidence": 0.0-1.0, "category": "plant/bird/insect/mammal/fungus/other", "note": "一言メモ"}
]

生物が一切映っていない場合のみ [] を返してください。
JSONのみ出力。
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
        'temperature' => 0.4,
        'maxOutputTokens' => 500,
    ],
];

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 12,
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
