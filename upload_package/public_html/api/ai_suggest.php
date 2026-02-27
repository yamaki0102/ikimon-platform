<?php

/**
 * AI Suggest API — Phase C: AI同定ブリッジ（複数画像対応）
 * 
 * 複数写真を受け取り、Gemini Flash APIで生物の分類候補を返す。
 * 
 * POST /api/ai_suggest.php
 * - photos[]: files (image/jpeg, image/png, image/webp) — 最大3枚
 * - photo: file (後方互換: 1枚のみの場合)
 * 
 * @version 2.0.0 — Multi-Photo Support
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/CSRF.php';

// ── Rate Limiting (Simple per-session) ──
session_start();
$now = time();
$rateKey = '_ai_suggest_timestamps';
$rateLimitWindow = 60;
$rateLimitMax = 10;

if (!isset($_SESSION[$rateKey])) {
    $_SESSION[$rateKey] = [];
}
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

// Check API Key
if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'ai_not_configured', 'message' => 'AI機能は現在準備中です。']);
    exit;
}

// ── Collect Photos (multi or single) ──
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$maxPhotos = 3;
$maxFileSize = 10 * 1024 * 1024; // 10MB per file

$uploadedFiles = [];

// Support photos[] (multi) or photo (single, backward compat)
if (isset($_FILES['photos']) && is_array($_FILES['photos']['name'])) {
    $count = min(count($_FILES['photos']['name']), $maxPhotos);
    for ($i = 0; $i < $count; $i++) {
        if ($_FILES['photos']['error'][$i] !== UPLOAD_ERR_OK) continue;
        $uploadedFiles[] = [
            'tmp_name' => $_FILES['photos']['tmp_name'][$i],
            'size' => $_FILES['photos']['size'][$i],
        ];
    }
} elseif (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
    // Backward compatibility: single photo
    $uploadedFiles[] = [
        'tmp_name' => $_FILES['photo']['tmp_name'],
        'size' => $_FILES['photo']['size'],
    ];
}

if (empty($uploadedFiles)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'no_photo', 'message' => '写真が必要です。']);
    exit;
}

// ── Validate & Resize All Photos ──
$startTime = hrtime(true);
$images = []; // [{data: base64, mime: string}]

foreach ($uploadedFiles as $file) {
    // Type check
    $mimeType = $finfo->file($file['tmp_name']);
    if (!in_array($mimeType, $allowedTypes, true)) continue;
    
    // Size check
    if ($file['size'] > $maxFileSize) continue;
    
    // Resize
    $resized = resizeAndStripExif($file['tmp_name'], $mimeType, 512);
    if ($resized !== false) {
        $images[] = $resized;
    }
}

if (empty($images)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'invalid_photos', 'message' => '有効な写真がありません。JPEG, PNG, WebPのみ対応しています。']);
    exit;
}

// ── Call Gemini Flash API ──
$result = callGeminiFlash($images);

$endTime = hrtime(true);
$processingMs = (int)(($endTime - $startTime) / 1e6);

if ($result === false) {
    http_response_code(502);
    echo json_encode(['success' => false, 'error' => 'ai_unavailable', 'message' => 'AI分析に失敗しました。通信状況を確認してください。']);
    exit;
}

echo json_encode([
    'success' => true,
    'suggestions' => $result['suggestions'],
    'meta' => [
        'model' => 'gemini-2.5-flash',
        'processing_ms' => $processingMs,
        'photos_analyzed' => count($images),
    ],
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);

// ──────────────────────────────────────────
// Functions
// ──────────────────────────────────────────

/**
 * Resize image to max dimension and strip all EXIF data.
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

    if ($w > $maxDim || $h > $maxDim) {
        $ratio = min($maxDim / $w, $maxDim / $h);
        $newW = (int)($w * $ratio);
        $newH = (int)($h * $ratio);

        $resized = imagecreatetruecolor($newW, $newH);
        if ($mimeType === 'image/png') {
            imagealphablending($resized, false);
            imagesavealpha($resized, true);
        }
        imagecopyresampled($resized, $img, 0, 0, 0, 0, $newW, $newH, $w, $h);
        imagedestroy($img);
        $img = $resized;
    }

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
 * Call Gemini 2.5 Flash API with one or more images for species identification.
 * @param array $images Array of ['data' => base64, 'mime' => mimeType]
 */
function callGeminiFlash(array $images): array|false
{
    $apiKey = GEMINI_API_KEY;
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    $photoCount = count($images);
    $multiPhotoNote = $photoCount > 1
        ? "\n\n注意: {$photoCount}枚の写真が提供されています。これらは同一の生き物を異なる角度から撮影したものです。すべての写真を総合的に判断して分類してください。"
        : '';

    $prompt = <<<PROMPT
あなたは生物多様性の専門家で、一般の人にもわかりやすく説明するのが得意です。この写真に写っている生き物を分類してください。{$multiPhotoNote}

## ルール
1. **科（Family）レベルまでの同定**にとどめてください。種レベルの断定は禁止です。
2. 写真に複数の生き物が見える場合は、最大3つまで候補を出してください。
3. 各候補に対して以下を出力してください:
   - label: 日本語の分類名（例: 「ツツジ科」「シジミチョウ科」「カモ科」）。目名は省略して科名のみ。
   - emoji: その生き物を表す最適な絵文字（1文字）
   - confidence: "high"（かなり確信）、"medium"（たぶん）、"low"（わからない）
   - reason: なぜそう判断したか（30文字以内の日本語）
   - examples: **一般人が知っているメジャーな種を2〜3個**列挙（例: 「ブルーベリー、ツツジ、サツキ」）。学名ではなく日本語の通称で。
4. 生き物が写っていない場合は空の配列を返してください。
5. 確信が持てない場合は confidence を "low" にして正直に伝えてください。

## 出力形式（JSON のみ）
{"suggestions": [{"label": "...", "emoji": "...", "confidence": "...", "reason": "...", "examples": "..."}]}

JSONのみ出力し、説明文やマークダウンは含めないでください。
PROMPT;

    // Build parts array: prompt text + all images
    $parts = [['text' => $prompt]];
    foreach ($images as $img) {
        $parts[] = [
            'inline_data' => [
                'mime_type' => $img['mime'],
                'data' => $img['data'],
            ],
        ];
    }

    $payload = [
        'contents' => [
            ['parts' => $parts],
        ],
        'generationConfig' => [
            'temperature' => 0.2,
            'maxOutputTokens' => 512,
            'responseMimeType' => 'application/json',
        ],
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ["Content-Type: application/json", "x-goog-api-key: " . $apiKey],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 25,       // Increased for multi-photo
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
        return ['suggestions' => []];
    }

    // Gemini 2.5 Flash (thinking model) may return multiple parts; use last text part
    $parts = $decoded['candidates'][0]['content']['parts'] ?? [];
    $text = '';
    foreach ($parts as $part) {
        if (isset($part['text'])) $text = $part['text'];
    }
    if (empty($text)) {
        error_log("[ai_suggest] Empty response from Gemini API");
        return ['suggestions' => []];
    }

    // Parse JSON from Gemini response (may have markdown wrapper)
    $text = trim($text);
    if (str_starts_with($text, '```')) {
        $text = preg_replace('/^```(?:json)?\\s*/', '', $text);
        $text = preg_replace('/\\s*```$/', '', $text);
    }

    $parsed = json_decode($text, true);
    if (!$parsed || !isset($parsed['suggestions'])) {
        error_log("[ai_suggest] Could not parse suggestions from: {$text}");
        return ['suggestions' => []];
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

        if (count($suggestions) >= 3) break;
    }

    return ['suggestions' => $suggestions];
}
