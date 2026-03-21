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

// ── Validate Photos (multiple) ──
// Support both 'photos[]' (multi) and legacy 'photo' (single)
$photoFiles = [];
if (isset($_FILES['photos']) && is_array($_FILES['photos']['tmp_name'])) {
    foreach ($_FILES['photos']['tmp_name'] as $i => $tmpName) {
        if ($_FILES['photos']['error'][$i] === UPLOAD_ERR_OK) {
            $photoFiles[] = [
                'tmp_name' => $tmpName,
                'size' => $_FILES['photos']['size'][$i],
            ];
        }
    }
} elseif (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
    $photoFiles[] = [
        'tmp_name' => $_FILES['photo']['tmp_name'],
        'size' => $_FILES['photo']['size'],
    ];
}

if (empty($photoFiles)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'no_photo', 'message' => '写真が必要です。']);
    exit;
}

// Limit to 5 photos max
$photoFiles = array_slice($photoFiles, 0, 5);

$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
$finfo = new finfo(FILEINFO_MIME_TYPE);

// ── Validate & Resize all photos ──
$startTime = hrtime(true);
$resizedPhotos = [];

foreach ($photoFiles as $pf) {
    $mimeType = $finfo->file($pf['tmp_name']);
    if (!in_array($mimeType, $allowedTypes, true)) continue;
    if ($pf['size'] > 10 * 1024 * 1024) continue;

    $resized = resizeAndStripExif($pf['tmp_name'], $mimeType, 512);
    if ($resized !== false) {
        $resizedPhotos[] = $resized;
    }
}

if (empty($resizedPhotos)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'invalid_photos', 'message' => '有効な写真がありません。JPEG, PNG, WebP (10MB以下) を使用してください。']);
    exit;
}

// ── Call Gemini Flash API with all photos ──
$result = callGeminiFlash($resizedPhotos);

$endTime = hrtime(true);
$processingMs = (int)(($endTime - $startTime) / 1e6);

if ($result === false) {
    http_response_code(502);
    echo json_encode(['success' => false, 'error' => 'ai_unavailable', 'message' => 'AI分析に失敗しました。通信状況を確認してください。']);
    exit;
}

// Apply Identifiability filter (Phase 16)
$identifiabilityWarnings = [];
try {
    require_once __DIR__ . '/../../libs/IdentifiabilityScorer.php';
    $filteredSuggestions = IdentifiabilityScorer::filterSuggestions($result['suggestions']);
    foreach ($filteredSuggestions as $s) {
        if (!empty($s['identifiability_warning'])) {
            $identifiabilityWarnings[] = $s['identifiability_warning'];
        }
    }
    $result['suggestions'] = $filteredSuggestions;
} catch (\Throwable $e) {
    error_log("[ai_suggest] IdentifiabilityScorer failed: " . substr($e->getMessage(), 0, 80));
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
    'annotations' => $result['annotations'] ?? [],
    'comparison_note' => $result['comparison_note'] ?? null,
    'identifiability_warnings' => $identifiabilityWarnings,
    'meta' => [
        'model' => 'gemini-3.1-flash-lite-preview',
        'processing_ms' => $processingMs,
        'omoikane' => $omoikaneMeta,
        'phase' => 16,
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
 * Call Gemini 3.1 Flash Lite API with multiple images for species identification + environment analysis.
 * Returns parsed suggestions + environment or false.
 *
 * @param array $resizedPhotos Array of ['data' => base64, 'mime' => 'image/jpeg']
 */
function callGeminiFlash(array $resizedPhotos): array|false
{
    $apiKey = GEMINI_API_KEY;
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key={$apiKey}";

    $photoCount = count($resizedPhotos);
    $multiPhotoInstruction = $photoCount > 1
        ? "同じ生物を{$photoCount}枚の異なるアングルで撮影した写真です。**全ての写真を総合的に分析**して判断してください。1枚では見えない特徴（翅の裏表、体の模様、サイズ感など）を組み合わせることで、より正確で自信のある分類が可能になります。"
        : "この写真に写っている生き物を分類し、撮影環境も分析してください。";

    $prompt = <<<PROMPT
あなたは生物多様性の専門家で、一般の人にもわかりやすく説明するのが得意です。{$multiPhotoInstruction}

## ルール
1. **種（Species）レベルの断定は禁止**。目・科・属など、確信度に応じた適切な分類階級で回答してください。自信があれば属レベル、不確かなら目レベルなど柔軟に判断。
2. 写真に複数の生き物が見える場合は、最大3つまで候補を出してください。
3. 各候補に対して以下を出力してください:
   - label: 日本語の分類名（例: 「ツツジ科」「シジミチョウ科」「カモ科」「テントウムシ属」「チョウ目」）。
   - emoji: その生き物を表す最適な絵文字（1文字）
   - confidence: "high"（かなり確信）、"medium"（たぶん）、"low"（わからない）
   - reason: なぜそう判断したか（30文字以内の日本語）
   - examples: **一般人が知っているメジャーな種を2〜3個**、括弧内に簡潔な見分け特徴を付記（例: 「マンリョウ(実が下垂)、カラタチバナ(葉が細い)、ヤブコウジ(矮小で地を這う)」）。学名ではなく日本語の通称で。
4. 生き物が写っていない場合はsuggestionsを空の配列にしてください。
5. 確信が持てない場合は confidence を "low" にして正直に伝えてください。

## 環境分析
写真の背景や状況から、以下も推定してください（environment オブジェクトとして出力）:
- biome: 撮影環境。"forest"(森林), "grassland"(草地・河川敷), "wetland"(湿地・水辺), "coastal"(海岸・干潟), "urban"(都市・公園), "farmland"(農地・里山) のいずれか。判断できなければ "unknown"。
- cultivation: "wild"(野生) or "cultivated"(植栽・飼育)。花壇や鉢植え、飼育ケージなら cultivated。
- life_stage: "adult"(成体/成虫), "juvenile"(幼体/幼虫), "egg"(卵・種子), "trace"(痕跡・足跡) のいずれか。判断できなければ "unknown"。
- substrate_tags: 地面の状態の配列。次から該当するものを選択: "rock"(岩場), "sand"(砂地), "gravel"(砂利), "grass"(草地), "leaf_litter"(落ち葉), "deadwood"(倒木・朽木), "water"(水辺), "artificial"(人工物)。該当なしなら空配列。

## アノテーション（annotations）
写真から判別できる生物学的アノテーションを推定してください:
- life_stage_detail: "adult"(成虫/成体), "larva"(幼虫/幼体), "pupa"(蛹), "egg"(卵/卵嚢), "nymph"(若虫), "unknown" のいずれか
- phenology: 植物のみ。"flowering"(開花), "fruiting"(結実), "budding"(蕾/発芽), "senescing"(落葉/紅葉), "dormant"(休眠), "none"(該当なし) のいずれか。動物なら "none"
- sex: "male"(オス), "female"(メス), "unknown" のいずれか
- behavior: 観察できる行動。"feeding"(採餌), "nesting"(営巣), "mating"(交尾), "flying"(飛翔), "resting"(静止), "singing"(鳴き声), "none"(特になし) のいずれか

## 類似種比較（comparison_note）
候補が2つ以上ある場合、最も可能性の高い候補と2番目の候補について、見分けのポイントを1行（40文字以内）で記述してください。候補が1つしかない場合はnull。

## 出力形式（JSON のみ）
{"suggestions": [{"label": "...", "emoji": "...", "confidence": "...", "reason": "...", "examples": "..."}], "environment": {"biome": "...", "cultivation": "...", "life_stage": "...", "substrate_tags": [...]}, "annotations": {"life_stage_detail": "...", "phenology": "...", "sex": "...", "behavior": "..."}, "comparison_note": "..."}

JSONのみ出力し、説明文やマークダウンは含めないでください。
PROMPT;

    // Build parts: prompt text + all images
    $parts = [['text' => $prompt]];
    foreach ($resizedPhotos as $photo) {
        $parts[] = [
            'inline_data' => [
                'mime_type' => $photo['mime'],
                'data' => $photo['data'],
            ],
        ];
    }

    $payload = [
        'contents' => [
            [
                'parts' => $parts,
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

    // Validate and sanitize annotations (Phase 16)
    $ann = $parsed['annotations'] ?? [];
    $validLifeStageDetail = ['adult', 'larva', 'pupa', 'egg', 'nymph', 'unknown'];
    $validPhenology = ['flowering', 'fruiting', 'budding', 'senescing', 'dormant', 'none'];
    $validSex = ['male', 'female', 'unknown'];
    $validBehavior = ['feeding', 'nesting', 'mating', 'flying', 'resting', 'singing', 'none'];

    $annotations = [
        'life_stage_detail' => in_array($ann['life_stage_detail'] ?? '', $validLifeStageDetail, true) ? $ann['life_stage_detail'] : 'unknown',
        'phenology' => in_array($ann['phenology'] ?? '', $validPhenology, true) ? $ann['phenology'] : 'none',
        'sex' => in_array($ann['sex'] ?? '', $validSex, true) ? $ann['sex'] : 'unknown',
        'behavior' => in_array($ann['behavior'] ?? '', $validBehavior, true) ? $ann['behavior'] : 'none',
    ];

    // Comparison note (Phase 16)
    $comparisonNote = null;
    if (!empty($parsed['comparison_note']) && is_string($parsed['comparison_note'])) {
        $comparisonNote = mb_substr(strip_tags($parsed['comparison_note']), 0, 60);
    }

    return [
        'suggestions' => $suggestions,
        'environment' => $environment,
        'annotations' => $annotations,
        'comparison_note' => $comparisonNote,
    ];
}
