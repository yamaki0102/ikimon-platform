<?php

/**
 * API v2: Species Story — マイ図鑑の種ごとパーソナライズ解説
 *
 * GET /api/v2/species_story.php?taxon_key=xxx
 *
 * ユーザーの出会いコンテキスト（場所・季節・時間帯・回数）を含めた
 * AI生成の短い解説を返す。結果はキャッシュ。
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Services/MyZukanService.php';
require_once __DIR__ . '/../../libs/Cache.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, max-age=3600');

Auth::init();
if (!Auth::isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['error' => 'Login required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$userId = Auth::user()['id'];
$taxonKey = $_GET['taxon_key'] ?? '';

if (!$taxonKey) {
    http_response_code(400);
    echo json_encode(['error' => 'taxon_key required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
    echo json_encode(['success' => true, 'story' => null, 'reason' => 'AI not configured'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$cacheKey = "species_story_{$userId}_{$taxonKey}";
$cached = Cache::get($cacheKey, 86400 * 365);
if ($cached !== null) {
    echo json_encode(['success' => true, 'story' => $cached], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$entry = MyZukanService::getSpeciesDetail($userId, $taxonKey);
if (!$entry) {
    http_response_code(404);
    echo json_encode(['error' => 'Species not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$encounterSummary = buildEncounterContext($entry);
$story = generateStory($entry, $encounterSummary);

if ($story) {
    Cache::set($cacheKey, $story, 86400 * 365);
}

echo json_encode(['success' => true, 'story' => $story], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);

function buildEncounterContext(array $entry): string
{
    $name = $entry['name'] ?? '';
    $sciName = $entry['scientific_name'] ?? '';
    $group = $entry['group'] ?? '';
    $rank = $entry['rank'] ?? 'species';
    $count = $entry['encounter_count'] ?? 0;
    $categories = $entry['categories'] ?? [];
    $firstDate = $entry['first_encounter'] ?? '';
    $latestDate = $entry['latest_encounter'] ?? '';

    $locations = [];
    $seasons = [];
    $notes = [];
    $catLabels = ['post' => '写真投稿', 'walk' => 'ウォーク', 'scan' => 'スキャン', 'identify' => '同定', 'audio' => '音声検出'];
    $catTexts = array_map(fn($c) => $catLabels[$c] ?? $c, $categories);

    foreach ($entry['encounters'] ?? [] as $enc) {
        if (!empty($enc['location_label'])) $locations[] = $enc['location_label'];
        if (!empty($enc['season_icon'])) $seasons[] = $enc['season_icon'];
        if (!empty($enc['note']) && mb_strlen($enc['note']) > 3) $notes[] = $enc['note'];
    }

    $locations = array_unique($locations);
    $seasons = array_unique($seasons);

    $ctx = "種名: {$name}";
    if ($sciName) $ctx .= " ({$sciName})";
    if ($group) $ctx .= "\n分類群: {$group}";
    if ($rank !== 'species') $ctx .= "\n分類ランク: {$rank}（種レベルまで特定されていない）";
    $ctx .= "\n出会い回数: {$count}回";
    $ctx .= "\n出会い方: " . implode('、', $catTexts);
    if ($firstDate) $ctx .= "\n初出会い: {$firstDate}";
    if ($latestDate && $latestDate !== $firstDate) $ctx .= "\n最新出会い: {$latestDate}";
    if (!empty($locations)) $ctx .= "\n出会った場所: " . implode('、', array_slice($locations, 0, 5));
    if (!empty($seasons)) $ctx .= "\n季節: " . implode(' ', $seasons);
    if (!empty($notes)) $ctx .= "\nユーザーのメモ: " . implode(' / ', array_slice($notes, 0, 3));

    return $ctx;
}

function generateStory(array $entry, string $context): ?string
{
    $prompt = <<<PROMPT
以下の出会い情報をもとに、この生き物についての短い解説を書いてください。

【ルール】
- 2〜4文（100〜200文字程度）
- 中高生〜大人が「へえ」と思える豆知識や生態の面白さを1つ入れる
- ユーザーの出会いコンテキスト（季節・回数・方法）に軽く触れる
- 和名が「常緑広葉樹」「ロゼット型草本」等の一般名称の場合は、その分類群の特徴や代表種を紹介する
- 事実に基づく情報のみ。不確かなことは書かない
- 一般的なAIの口調で良い。過度な絵文字や語りかけは不要

【出会い情報】
{$context}

【解説】
PROMPT;

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=' . GEMINI_API_KEY;

    $payload = [
        'contents' => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => [
            'maxOutputTokens' => 300,
            'temperature' => 0.8,
        ],
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) return null;

    $data = json_decode($response, true);
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;

    if ($text) {
        $text = trim($text);
        $text = preg_replace('/^[\s\*#]+/', '', $text);
    }

    return $text ?: null;
}
