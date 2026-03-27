<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/FieldAssistantTools.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST only', 405);
}

if (!api_rate_limit('field_assistant', 30, 60)) {
    api_error('Rate limit exceeded', 429);
}

$body = api_json_body();
$message = trim($body['message'] ?? '');
if ($message === '') {
    api_error('message is required');
}

$conversationHistory = $body['history'] ?? [];
$sessionContext = [
    'lat' => isset($body['lat']) ? (float)$body['lat'] : null,
    'lng' => isset($body['lng']) ? (float)$body['lng'] : null,
    'session_id' => $body['session_id'] ?? null,
    'recent_detections' => $body['recent_detections'] ?? [],
    'transport_mode' => $body['transport_mode'] ?? 'walk',
    'user_id' => null,
];

@session_start();
if (isset($_SESSION['user_id'])) {
    $sessionContext['user_id'] = $_SESSION['user_id'];
}

if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
    api_error('AI service not configured', 503);
}

$model = 'gemini-3.1-flash-lite-preview';
$tools = new FieldAssistantTools();

$month = (int)date('n');
$seasons = [1 => '冬', 2 => '冬', 3 => '春', 4 => '春', 5 => '春', 6 => '梅雨', 7 => '夏', 8 => '夏', 9 => '秋', 10 => '秋', 11 => '秋', 12 => '冬'];
$season = $seasons[$month];
$hour = (int)date('G');
$timeOfDay = match (true) {
    $hour < 6 => '早朝',
    $hour < 10 => '朝',
    $hour < 15 => '昼',
    $hour < 18 => '夕方',
    default => '夜',
};

$detectionsText = '';
if (!empty($sessionContext['recent_detections'])) {
    $names = array_map(fn($d) => $d['name'] ?? $d['taxon_name'] ?? '不明', array_slice($sessionContext['recent_detections'], 0, 10));
    $detectionsText = implode(', ', $names);
} else {
    $detectionsText = 'まだなし';
}

$locationText = '';
if ($sessionContext['lat'] && $sessionContext['lng']) {
    $locationText = sprintf('%.3f, %.3f', $sessionContext['lat'], $sessionContext['lng']);
}

$systemPrompt = <<<PROMPT
あなたはikimon.lifeのフィールドガイド「愛(Ai)」。ユーザーは野外で自然観察中。

ルール:
- 日本語、友達のように話す。2-3文で簡潔に（歩きながら聴くので短く）
- 和名優先。不確かなら「〜かもしれない」と正直に
- BirdNET/ML結果は参考値であることを伝える
- 質問されたらまず lookup_species で図鑑を引く
- 環境コンテキスト(季節・場所・時間帯・検出種)を自然に活用
- 珍しい・レアなどの希少性を煽る表現は避ける

現在:
- 季節: {$month}月 ({$season})
- 時間: {$timeOfDay}
- 位置: {$locationText}
- 移動手段: {$sessionContext['transport_mode']}
- 今日の検出種: {$detectionsText}
PROMPT;

$contents = [];
foreach ($conversationHistory as $turn) {
    $role = ($turn['role'] ?? '') === 'assistant' ? 'model' : 'user';
    $contents[] = [
        'role' => $role,
        'parts' => [['text' => $turn['content'] ?? '']],
    ];
}
$contents[] = [
    'role' => 'user',
    'parts' => [['text' => $message]],
];

$request = [
    'system_instruction' => [
        'parts' => [['text' => $systemPrompt]],
    ],
    'contents' => $contents,
    'tools' => [
        ['function_declarations' => FieldAssistantTools::getToolDeclarations()],
    ],
    'generation_config' => [
        'max_output_tokens' => 300,
        'temperature' => 0.7,
    ],
];

$maxRounds = 3;
$round = 0;
$finalText = '';
$toolsUsed = [];

while ($round < $maxRounds) {
    $round++;

    $response = callGeminiApi($model, $request);
    if ($response === null) {
        api_error('AI service temporarily unavailable', 503);
    }

    $candidate = $response['candidates'][0] ?? null;
    if (!$candidate) {
        api_error('No response from AI', 502);
    }

    $parts = $candidate['content']['parts'] ?? [];
    $functionCalls = [];
    $textParts = [];

    foreach ($parts as $part) {
        if (isset($part['functionCall'])) {
            $functionCalls[] = $part['functionCall'];
        }
        if (isset($part['text'])) {
            $textParts[] = $part['text'];
        }
    }

    if (empty($functionCalls)) {
        $finalText = implode('', $textParts);
        break;
    }

    $request['contents'][] = [
        'role' => 'model',
        'parts' => $parts,
    ];

    $toolResponseParts = [];
    foreach ($functionCalls as $fc) {
        $toolName = $fc['name'];
        $toolArgs = $fc['args'] ?? [];
        $toolResult = $tools->executeTool($toolName, $toolArgs, $sessionContext);
        $toolsUsed[] = $toolName;

        $toolResponseParts[] = [
            'functionResponse' => [
                'name' => $toolName,
                'response' => $toolResult,
            ],
        ];
    }

    $request['contents'][] = [
        'role' => 'user',
        'parts' => $toolResponseParts,
    ];
}

if ($finalText === '' && $round >= $maxRounds) {
    $finalText = 'ごめん、ちょっと情報をまとめきれなかった。もう一度聞いてもらえる？';
}

api_success([
    'reply' => $finalText,
    'tools_used' => $toolsUsed,
], [
    'model' => $model,
    'rounds' => $round,
]);

function callGeminiApi(string $model, array $request): ?array
{
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':generateContent?key=' . GEMINI_API_KEY;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($request, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!is_string($response) || $response === '' || $httpCode !== 200) {
        return null;
    }

    return json_decode($response, true);
}
