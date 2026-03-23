<?php

/**
 * API v2: Voice Guide — AI解説 + VOICEVOX音声生成
 *
 * GET /api/v2/voice_guide.php
 *   ?name=シジュウカラ&scientific_name=Parus+minor&confidence=0.85&voice_mode=standard|zundamon
 *   ?mode=ambient&lat=35.0&lng=139.0&detected_species=シジュウカラ,ウグイス  (定期コメンタリー)
 *
 * レスポンス:
 *   { success: true, data: { guide_text: "...", audio_url: "..." } }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/OmoikaneSearchEngine.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Login required', 401);
}

if (!api_rate_limit('voice_guide', 30, 60)) {
    api_error('Rate limit exceeded', 429);
}

$requestMode = api_param('mode', 'detection');
$voiceMode = api_param('voice_mode', 'standard');
$isZundamon = ($voiceMode === 'zundamon');

$month = (int)date('n');
$hour = (int)date('G');
$seasonName = match(true) {
    $month >= 3 && $month <= 5 => '春',
    $month >= 6 && $month <= 8 => '夏',
    $month >= 9 && $month <= 11 => '秋',
    default => '冬',
};
$timeOfDay = match(true) {
    $hour >= 5 && $hour < 10 => '朝',
    $hour >= 10 && $hour < 16 => '日中',
    $hour >= 16 && $hour < 19 => '夕方',
    default => '夜',
};

// --- アンビエントモード（定期コメンタリー） ---
if ($requestMode === 'ambient') {
    $lat = api_param('lat', 0, 'float');
    $lng = api_param('lng', 0, 'float');
    $detectedSpecies = api_param('detected_species', '');
    $elapsedMin = api_param('elapsed_min', 0, 'int');

    $areaName = '';
    try {
        require_once ROOT_DIR . '/libs/GeoUtils.php';
        $geo = GeoUtils::reverseGeocode($lat, $lng);
        $areaName = trim(($geo['prefecture'] ?? '') . ' ' . ($geo['municipality'] ?? ''));
    } catch (Throwable $e) {}

    $styleInstruction = $isZundamon
        ? 'ずんだもんの口調で話してください。語尾は「〜のだ」「〜なのだ」。一人称は「ずんだもん」。'
        : '優しいネイチャーガイドの口調で話してください。';

    $topicPool = [
        'この地域の自然環境や生態系の特徴',
        'ネイチャーポジティブ（自然再興）の取り組み',
        '30by30目標と日本の生物多様性保全',
        'この季節に見られる生き物の行動パターン',
        '日本の里山が育む生物多様性',
        '身近な鳥や虫の意外な生態',
        '季節の移り変わりと生き物の関係',
        '都市と自然の共生について',
        '水辺の生態系の大切さ',
        '市民科学と生物多様性モニタリング',
    ];
    $topic = $topicPool[array_rand($topicPool)];

    $speciesContext = $detectedSpecies
        ? "さっき検出された種: {$detectedSpecies}。この種に関連づけて話を展開して。"
        : 'まだ検出がないので、この地域で出会えそうな生き物について話して。';

    $prompt = <<<PROMPT
あなたは車や自転車で移動中の人のネイチャーガイドです。
検出の合間に、聞いていて楽しい自然の話をしてください。

{$styleInstruction}

地域: {$areaName}（緯度{$lat}、経度{$lng}付近）
季節: {$seasonName}（{$month}月）  時間帯: {$timeOfDay}
経過時間: {$elapsedMin}分
{$speciesContext}

今回のテーマ: {$topic}

条件:
- 2〜3文、80文字以内
- 前回と違う話題になるよう、毎回新鮮な切り口で
- 難しい漢字はひらがなで（例: 囀り→さえずり、蝶→チョウ）
- 学名は使わないで
- 「へぇ」と思える内容、聞いて楽しい話に
- 地域や季節に関連した具体的な話がベスト
PROMPT;

    $guideText = _callGemini($prompt);
    if (empty($guideText)) {
        $guideText = $isZundamon
            ? "この辺りは自然豊かな場所なのだ！"
            : "自然を感じながらのドライブ、いいですね。";
    }

    $result = ['guide_text' => $guideText, 'audio_url' => null];
    if ($isZundamon) {
        $audioUrl = _generateVoicevoxAudio($guideText);
        if ($audioUrl) $result['audio_url'] = $audioUrl;
    }
    api_success($result);
}

// --- 検出モード ---
$name = api_param('name', '');
$sciName = api_param('scientific_name', '');
$confidence = api_param('confidence', 0.5, 'float');
$detectionCount = api_param('detection_count', 1, 'int');
$isFirstToday = api_param('is_first_today', '1') === '1';

if (empty($name) && empty($sciName)) {
    api_error('name or scientific_name required');
}

$traits = '';
try {
    $engine = new OmoikaneSearchEngine();
    $info = null;
    if ($sciName) {
        $info = $engine->getTraitsByScientificName($sciName);
    }
    if (!$info && $name) {
        $resolved = $engine->resolveByJapaneseName($name);
        if ($resolved && !empty($resolved['scientific_name'])) {
            $info = $engine->getTraitsByScientificName($resolved['scientific_name']);
        }
    }
    if ($info) {
        $parts = [];
        if (!empty($info['habitat'])) $parts[] = '生息地: ' . $info['habitat'];
        if (!empty($info['season'])) $parts[] = '季節: ' . $info['season'];
        if (!empty($info['morphological_traits'])) $parts[] = '特徴: ' . $info['morphological_traits'];
        if (!empty($info['notes'])) $parts[] = '備考: ' . $info['notes'];
        $traits = implode('。', $parts);
    }
} catch (Throwable $e) {
    // non-critical
}

$displayName = $name ?: $sciName;

$styleInstruction = $isZundamon
    ? 'ずんだもんの口調で話してください。語尾は「〜のだ」「〜なのだ」を使い、元気で親しみやすい感じ。一人称は「ずんだもん」。'
    : '優しいネイチャーガイドの口調で話してください。「〜ですよ」「〜なんです」など親しみやすく。';

$contextParts = [];
if ($isFirstToday) $contextParts[] = '今日初めての検出';
if ($detectionCount > 1) $contextParts[] = "今日{$detectionCount}回目の検出";
$contextStr = $contextParts ? implode('、', $contextParts) : '';

$prompt = <<<PROMPT
あなたは移動中の人に音声で読み上げる、生き物の短い解説を作る係です。

{$styleInstruction}

生き物: {$displayName}（{$sciName}）
季節: {$seasonName}（{$month}月）
時間帯: {$timeOfDay}
{$contextStr}

図鑑情報: {$traits}

条件:
- 1〜2文、50文字以内
- 毎回違う角度で（生態・文化・歴史・季節の行動・豆知識・名前の由来などランダムに選んで）
- 音声読み上げ用なので、難しい漢字はひらがなで書く（例: 囀り→さえずり、雌雄→オスメス）
- 学名は読み上げないで
- 聞いて「へぇ」と思える内容に
PROMPT;

$guideText = _callGemini($prompt);

if (empty($guideText)) {
    $guideText = $isZundamon
        ? "{$displayName}を見つけたのだ！"
        : "{$displayName}がいますよ。";
}

$result = ['guide_text' => $guideText, 'audio_url' => null];

if ($isZundamon && !empty($guideText)) {
    $audioUrl = _generateVoicevoxAudio($guideText);
    if ($audioUrl) {
        $result['audio_url'] = $audioUrl;
    }
}

api_success($result);

function _callGemini(string $prompt): string
{
    $apiKey = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '';
    if (!$apiKey) return '';

    $payload = [
        'contents' => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => [
            'temperature' => 1.2,
            'maxOutputTokens' => 150,
            'topP' => 0.95,
        ],
    ];

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}",
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 3,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $text = trim($text);
        return trim($text, '"\'');
    }
    return '';
}

function _generateVoicevoxAudio(string $text): ?string
{
    $voicevoxHost = 'http://127.0.0.1:50021';

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $voicevoxHost . '/audio_query?text=' . urlencode($text) . '&speaker=3',
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_CONNECTTIMEOUT => 1,
    ]);
    $queryJson = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$queryJson) return null;

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $voicevoxHost . '/synthesis?speaker=3',
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => $queryJson,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 1,
    ]);
    $wavData = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$wavData) return null;

    $yearMonth = date('Y-m');
    $dir = PUBLIC_DIR . "/uploads/audio/voice/{$yearMonth}";
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $filename = 'vg_' . bin2hex(random_bytes(6)) . '.wav';
    $path = "{$dir}/{$filename}";
    file_put_contents($path, $wavData);

    return "/uploads/audio/voice/{$yearMonth}/{$filename}";
}
