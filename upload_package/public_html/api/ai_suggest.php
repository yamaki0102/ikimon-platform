<?php

/**
 * AI Suggest API — Phase B: AI同定ブリッジ
 * 
 * 写真を受け取り、Gemini Flash APIで生物の分類候補を返す。
 * 
 * POST /api/ai_suggest.php
 * - photo: file (image/jpeg, image/png, image/webp)
 * 
 * Returns JSON:
 * {
 *   "success": true,
 *   "suggestions": [
 *     { "label": "シジミチョウ科", "confidence": "high", "emoji": "🦋", "reason": "翅の模様から推定" }
 *   ],
 *   "environment": { "biome": "forest", "cultivation": "wild", "life_stage": "adult", "substrate_tags": ["grass"] },
 *   "meta": { "model": "gemini-3.1-flash-lite-preview", "processing_ms": 1234 }
 * }
 * 
 * 設計原則:
 * - 512px以下にリサイズしてからAPI送信（元画像は送信しない）
 * - EXIF情報（GPS含む）は完全除去
 * - レスポンスは種(Species)未満の分類階級（目・科・属）で返す
 * - ユーザー情報は一切送信しない
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/CSRF.php';

// ── Rate Limiting (Simple per-session) ──
session_start();
$now = time();
$rateKey = '_ai_suggest_timestamps';
$rateLimitWindow = 60; // seconds
$rateLimitMax = 10;    // max requests per window

if (!isset($_SESSION[$rateKey])) {
    $_SESSION[$rateKey] = [];
}
// Clean old timestamps
$_SESSION[$rateKey] = array_filter($_SESSION[$rateKey], fn($t) => $t > ($now - $rateLimitWindow));

if (count($_SESSION[$rateKey]) >= $rateLimitMax) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'rate_limit', 'message' => 'リクエストが多すぎます。1分後に再試行してください。']);
    exit;
}
$_SESSION[$rateKey][] = $now;

// ── Validate Request ──
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'method_not_allowed']);
    exit;
}

// CSRF (optional for API, but adds protection)
// Skip CSRF for now — this is called from JavaScript with FormData
// We rely on same-origin policy + rate limiting

// Check API Key
if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'ai_not_configured', 'message' => 'AI機能は現在準備中です。']);
    exit;
}

// ── Validate Photo ──
if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'no_photo', 'message' => '写真が必要です。']);
    exit;
}

$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($_FILES['photo']['tmp_name']);

if (!in_array($mimeType, $allowedTypes, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'invalid_type', 'message' => 'JPEG, PNG, WebPのみ対応しています。']);
    exit;
}

// Max file size: 10MB
if ($_FILES['photo']['size'] > 10 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'file_too_large', 'message' => 'ファイルサイズは10MB以下にしてください。']);
    exit;
}

// ── Resize to 512px (privacy + performance) ──
$startTime = hrtime(true);

$resized = resizeAndStripExif($_FILES['photo']['tmp_name'], $mimeType, 512);
if ($resized === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'resize_failed', 'message' => '画像の処理に失敗しました。']);
    exit;
}

// ── Call Gemini Flash API ──
$result = callGeminiFlash($resized['data'], $resized['mime']);

$endTime = hrtime(true);
$processingMs = (int)(($endTime - $startTime) / 1e6);

if ($result === false) {
    http_response_code(502);
    echo json_encode(['success' => false, 'error' => 'ai_unavailable', 'message' => 'AI分析に失敗しました。通信状況を確認してください。']);
    exit;
}

// Cross-validate with Omoikane knowledge graph (non-fatal)
$enrichedSuggestions = $result['suggestions'];
$omoikaneMeta = [
    'enabled' => false,
    'match_count' => 0,
    'caution_count' => 0,
    'examples_total' => 0,
    'examples_matched' => 0,
    'matched_by_ja_name' => 0,
    'matched_by_fallback' => 0,
];
try {
    require_once __DIR__ . '/../../libs/OmoikaneInferenceEnhancer.php';
    $enhancer = new OmoikaneInferenceEnhancer();
    $enhanced = $enhancer->crossValidate(
        $result['suggestions'],
        $result['environment'] ?? [],
        [
            'lat' => $_POST['lat'] ?? null,
            'lng' => $_POST['lng'] ?? null,
            'observed_at' => $_POST['observed_at'] ?? null,
        ]
    );
    $enrichedSuggestions = $enhanced['suggestions'];
    $stats = $enhanced['stats'] ?? [];
    $omoikaneMeta['enabled'] = true;
    $omoikaneMeta['examples_total'] = $stats['examples_total'] ?? 0;
    $omoikaneMeta['examples_matched'] = $stats['examples_matched'] ?? 0;
    $omoikaneMeta['matched_by_ja_name'] = $stats['matched_by_ja_name'] ?? 0;
    $omoikaneMeta['matched_by_fallback'] = $stats['matched_by_fallback'] ?? 0;
    foreach ($enrichedSuggestions as $s) {
        if (($s['omoikane_support'] ?? 0) > 0 || ($s['omoikane_conflict'] ?? 0) > 0) $omoikaneMeta['match_count']++;
        if (!empty($s['caution'])) $omoikaneMeta['caution_count']++;
    }
    // Sampled logging: log every request for first 100, then 1-in-10
    static $logCounter = 0;
    $logCounter++;
    if ($logCounter <= 100 || $logCounter % 10 === 0) {
        error_log(sprintf(
            "[ai_suggest] Omoikane: examples=%d matched=%d(ja:%d/fb:%d) caution=%d biome=%s",
            $omoikaneMeta['examples_total'],
            $omoikaneMeta['examples_matched'],
            $omoikaneMeta['matched_by_ja_name'],
            $omoikaneMeta['matched_by_fallback'],
            $omoikaneMeta['caution_count'],
            $result['environment']['biome'] ?? 'unknown'
        ));
    }
} catch (\Exception $e) {
    // Non-fatal: return original suggestions
    error_log("[ai_suggest] Omoikane crossValidate failed: " . substr($e->getMessage(), 0, 80));
}

echo json_encode([
    'success' => true,
    'suggestions' => $enrichedSuggestions,
    'environment' => $result['environment'] ?? [],
    'meta' => [
        'model' => 'gemini-3.1-flash-lite-preview',
        'processing_ms' => $processingMs,
        'omoikane' => $omoikaneMeta,
    ],
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);

// ──────────────────────────────────────────
// Functions
// ──────────────────────────────────────────

/**
 * Resize image to max dimension and strip all EXIF data.
 * Returns ['data' => base64, 'mime' => 'image/jpeg'] or false.
 */
function resizeAndStripExif(string $path, string $mimeType, int $maxDim): array|false
{
    $img = match ($mimeType) {
        'image/jpeg' => @imagecreatefromjpeg($path),
        'image/png'  => @imagecreatefrompng($path),
        'image/webp' => @imagecreatefromwebp($path),
        default      => false,
    };

    if (!$img) return false;

    $w = imagesx($img);
    $h = imagesy($img);

    // Calculate new dimensions
    if ($w > $maxDim || $h > $maxDim) {
        $ratio = min($maxDim / $w, $maxDim / $h);
        $newW = (int)($w * $ratio);
        $newH = (int)($h * $ratio);

        $resized = imagecreatetruecolor($newW, $newH);

        // Preserve transparency for PNG
        if ($mimeType === 'image/png') {
            imagealphablending($resized, false);
            imagesavealpha($resized, true);
        }

        imagecopyresampled($resized, $img, 0, 0, 0, 0, $newW, $newH, $w, $h);
        imagedestroy($img);
        $img = $resized;
    }

    // Output to JPEG (strips all EXIF, reduces size)
    ob_start();
    imagejpeg($img, null, 80);
    $data = ob_get_clean();
    imagedestroy($img);

    return [
        'data' => base64_encode($data),
        'mime' => 'image/jpeg',
    ];
}

/**
 * Call Gemini 3.1 Flash Lite API with image for species identification + environment analysis.
 * Returns parsed suggestions + environment or false.
 */
function callGeminiFlash(string $base64Image, string $mimeType): array|false
{
    $apiKey = GEMINI_API_KEY;
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key={$apiKey}";

    $prompt = <<<PROMPT
あなたは生物多様性の専門家で、一般の人にもわかりやすく説明するのが得意です。この写真に写っている生き物を分類し、撮影環境も分析してください。

## ルール
1. **種（Species）レベルの断定は禁止**。目・科・属など、確信度に応じた適切な分類階級で回答してください。自信があれば属レベル、不確かなら目レベルなど柔軟に判断。
2. 写真に複数の生き物が見える場合は、最大3つまで候補を出してください。
3. 各候補に対して以下を出力してください:
   - label: 日本語の分類名（例: 「ツツジ科」「シジミチョウ科」「カモ科」「テントウムシ属」「チョウ目」）。
   - emoji: その生き物を表す最適な絵文字（1文字）
   - confidence: "high"（かなり確信）、"medium"（たぶん）、"low"（わからない）
   - reason: なぜそう判断したか（30文字以内の日本語）
   - examples: **一般人が知っているメジャーな種を2〜3個**列挙（例: 「ブルーベリー、ツツジ、サツキ」）。学名ではなく日本語の通称で。
4. 生き物が写っていない場合はsuggestionsを空の配列にしてください。
5. 確信が持てない場合は confidence を "low" にして正直に伝えてください。

## 環境分析
写真の背景や状況から、以下も推定してください（environment オブジェクトとして出力）:
- biome: 撮影環境。"forest"(森林), "grassland"(草地・河川敷), "wetland"(湿地・水辺), "coastal"(海岸・干潟), "urban"(都市・公園), "farmland"(農地・里山) のいずれか。判断できなければ "unknown"。
- cultivation: "wild"(野生) or "cultivated"(植栽・飼育)。花壇や鉢植え、飼育ケージなら cultivated。
- life_stage: "adult"(成体/成虫), "juvenile"(幼体/幼虫), "egg"(卵・種子), "trace"(痕跡・足跡) のいずれか。判断できなければ "unknown"。
- substrate_tags: 地面の状態の配列。次から該当するものを選択: "rock"(岩場), "sand"(砂地), "gravel"(砂利), "grass"(草地), "leaf_litter"(落ち葉), "deadwood"(倒木・朽木), "water"(水辺), "artificial"(人工物)。該当なしなら空配列。

## 出力形式（JSON のみ）
{"suggestions": [{"label": "...", "emoji": "...", "confidence": "...", "reason": "...", "examples": "..."}], "environment": {"biome": "...", "cultivation": "...", "life_stage": "...", "substrate_tags": [...]}}

JSONのみ出力し、説明文やマークダウンは含めないでください。
PROMPT;

    $payload = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $prompt],
                    [
                        'inline_data' => [
                            'mime_type' => $mimeType,
                            'data' => $base64Image,
                        ],
                    ],
                ],
            ],
        ],
        'generationConfig' => [
            'temperature' => 0.2,
            'maxOutputTokens' => 768,
            'responseMimeType' => 'application/json',
        ],
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false || $httpCode !== 200) {
        error_log("[ai_suggest] Gemini API error: HTTP {$httpCode}, error: {$error}");
        return false;
    }

    $decoded = json_decode($response, true);
    if (!$decoded) {
        error_log("[ai_suggest] Invalid JSON from Gemini API");
        return false;
    }

    // Extract text content from Gemini response
    $text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if (empty($text)) {
        error_log("[ai_suggest] Empty response from Gemini API");
        return false;
    }

    // Parse JSON from Gemini response (may have markdown wrapper)
    $text = trim($text);
    // Remove possible ```json ... ``` wrapper
    if (str_starts_with($text, '```')) {
        $text = preg_replace('/^```(?:json)?\s*/', '', $text);
        $text = preg_replace('/\s*```$/', '', $text);
    }

    $parsed = json_decode($text, true);
    if (!$parsed || !isset($parsed['suggestions'])) {
        error_log("[ai_suggest] Could not parse suggestions from: {$text}");
        return false;
    }

    // Validate and sanitize suggestions
    $suggestions = [];
    foreach ($parsed['suggestions'] as $s) {
        if (!isset($s['label'])) continue;

        $suggestions[] = [
            'label' => mb_substr(strip_tags($s['label']), 0, 50),
            'emoji' => mb_substr($s['emoji'] ?? '🔬', 0, 2),
            'confidence' => in_array($s['confidence'] ?? '', ['high', 'medium', 'low'], true) ? $s['confidence'] : 'low',
            'reason' => mb_substr(strip_tags($s['reason'] ?? ''), 0, 30),
            'examples' => mb_substr(strip_tags($s['examples'] ?? ''), 0, 60),
        ];

        if (count($suggestions) >= 3) break; // Max 3 suggestions
    }

    // Validate and sanitize environment
    $env = $parsed['environment'] ?? [];
    $validBiomes = ['forest', 'grassland', 'wetland', 'coastal', 'urban', 'farmland', 'unknown'];
    $validStages = ['adult', 'juvenile', 'egg', 'trace', 'unknown'];
    $validSubstrates = ['rock', 'sand', 'gravel', 'grass', 'leaf_litter', 'deadwood', 'water', 'artificial'];

    $environment = [
        'biome' => in_array($env['biome'] ?? '', $validBiomes, true) ? $env['biome'] : 'unknown',
        'cultivation' => in_array($env['cultivation'] ?? '', ['wild', 'cultivated'], true) ? $env['cultivation'] : 'wild',
        'life_stage' => in_array($env['life_stage'] ?? '', $validStages, true) ? $env['life_stage'] : 'unknown',
        'substrate_tags' => array_values(array_intersect($env['substrate_tags'] ?? [], $validSubstrates)),
    ];

    return ['suggestions' => $suggestions, 'environment' => $environment];
}
