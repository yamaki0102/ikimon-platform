<?php

/**
 * PR Auto-Crafter API
 * 
 * Generates PR and SNS draft posts based on site biodiversity stats using Gemini Flash 2.5.
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/SiteManager.php';

// Rate Limiting (Simple per-session to prevent abuse)
session_start();
$now = time();
$rateKey = '_pr_generator_timestamps';
$rateLimitWindow = 3600; // 1 hour window
$rateLimitMax = 10;      // max requests per window

if (!isset($_SESSION[$rateKey])) {
    $_SESSION[$rateKey] = [];
}
$_SESSION[$rateKey] = array_filter($_SESSION[$rateKey], fn($t) => $t > ($now - $rateLimitWindow));

if (count($_SESSION[$rateKey]) >= $rateLimitMax) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'rate_limit', 'message' => 'リクエストが多すぎます。しばらく時間をおいてから再実行してください。'], JSON_UNESCAPED_UNICODE);
    exit;
}
$_SESSION[$rateKey][] = $now;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'method_not_allowed']);
    exit;
}

if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'ai_not_configured', 'message' => 'AI機能は現在準備中です。'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);
$siteId = $input['site_id'] ?? null;

if (!$siteId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'site_id is required']);
    exit;
}

$site = SiteManager::load($siteId);
if (!$site) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Site not found']);
    exit;
}

$stats = SiteManager::getSiteStats($siteId);

// Build prompt based on stats
$siteName = $site['name'];
$totalSpecies = $stats['total_species'];
$totalObs = $stats['total_observations'];
$redlistCount = $stats['redlist_count'];
$topSpecies = implode('、', array_keys($stats['top_species']));

$prompt = <<<PROMPT
あなたは企業の広報担当者を支援するプロのPRライターです。
以下の「市民参加型生物多様性モニタリングツール ikimon.life」で収集されたデータに基づいて、企業が自社の環境保全の取り組みを客観的にアピールするためのPR原案を生成してください。

【対象施設・緑地】
- 施設名: {$siteName}
- これまでに確認された総種数: {$totalSpecies} 種
- 累計観察データ数: {$totalObs} 件
- 発見された絶滅危惧・保全重要種の数: {$redlistCount} 種
- 主に見られる生き物: {$topSpecies}

【作成要件】
1. プレスリリース風のフォーマルな文章（タイトル、リード文、本文）
2. SNS用の短く親しみやすい投稿文（X向け, ハッシュタグ含む）
3. グリーンウォッシュ（言葉だけの環境配慮）にならないよう、「市民科学に基づく継続的なモニタリング」による「客観的なデータ」であることを強調してください。
4. HTMLではなく、Markdown形式で出力してください。

出力は以下の構成にしてください：
### 📝 プレスリリース原案
（本文）
### 📱 SNS投稿原案
（本文）
PROMPT;

// Call Gemini API
$apiKey = GEMINI_API_KEY;
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}";

$payload = [
    'contents' => [
        [
            'parts' => [
                ['text' => $prompt]
            ]
        ]
    ],
    'generationConfig' => [
        'temperature' => 0.4,
        'maxOutputTokens' => 1024,
    ]
];

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false || $httpCode !== 200) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'API Error from AI Service']);
    exit;
}

$decoded = json_decode($response, true);
$aiText = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? '';

echo json_encode([
    'success' => true,
    'content' => $aiText
], JSON_UNESCAPED_UNICODE);
