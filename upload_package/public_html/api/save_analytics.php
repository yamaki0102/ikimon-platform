<?php

/**
 * save_analytics.php — アナリティクスイベント受信API
 * 
 * POST: バッチイベントを受信してJSONファイルに保存
 * 日付パーティション: data/analytics/YYYY-MM-DD.json
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';

// POST only
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'POST required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Read body
$input = json_decode(file_get_contents('php://input'), true);
$events = $input['events'] ?? [];

if (empty($events) || !is_array($events)) {
    echo json_encode(['success' => false, 'message' => 'No events'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Analytics directory
$analyticsDir = DATA_DIR . '/analytics';
if (!is_dir($analyticsDir)) {
    mkdir($analyticsDir, 0777, true);
}

// 日付別パーティション
$today = date('Y-m-d');
$file = $analyticsDir . '/' . $today . '.json';

// 既存データ読み込み
$existing = [];
if (file_exists($file)) {
    $content = file_get_contents($file);
    $existing = json_decode($content, true) ?: [];
}

// バリデーション & サニタイズ
$allowedEvents = [
    'page_view',
    'post_start',
    'photo_added',
    'form_expand',
    'post_submit',
    'post_success',
    'bridge_click',
    'onboarding_step',
    'id_attempt',
    'notification_open',
    'today_card_view',
    'today_card_cta',
    'walk_habit_qualified',
    'identification_habit_qualified',
    'reflection_habit_qualified'
];

$added = 0;
foreach ($events as $event) {
    // 必須フィールドチェック
    if (empty($event['event']) || empty($event['session_id'])) continue;

    // ホワイトリスト外は無視
    if (!in_array($event['event'], $allowedEvents)) continue;

    $sanitized = [
        'event' => substr($event['event'], 0, 50),
        'data' => is_array($event['data'] ?? null) ? array_slice($event['data'], 0, 10) : [],
        'page' => substr($event['page'] ?? '', 0, 100),
        'session_id' => substr($event['session_id'], 0, 60),
        'timestamp' => $event['timestamp'] ?? date('c'),
        'viewport' => substr($event['viewport'] ?? '', 0, 20),
        'referrer' => substr($event['referrer'] ?? '', 0, 200),
        'ip_hash' => substr(md5($_SERVER['REMOTE_ADDR'] ?? ''), 0, 8), // プライバシー配慮: IPハッシュ
        'ua_short' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 100)
    ];

    $existing[] = $sanitized;
    $added++;
}

// 1日1万件上限
if (count($existing) > 10000) {
    $existing = array_slice($existing, -10000);
}

file_put_contents($file, json_encode($existing, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG), LOCK_EX);

echo json_encode(['success' => true, 'added' => $added], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
