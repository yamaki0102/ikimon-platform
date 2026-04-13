<?php

/**
 * API: Get Field Sessions
 *
 * ユーザーの観察データからフィールドセッション（自動グルーピング）を返す。
 * セッション = 時間的・空間的に近い投稿のまとまり = 「1回のフィールドワーク」
 *
 * GET params:
 *   - period: week | month | year | all (default: month)
 *   - session_index: (optional) 特定セッションの詳細を取得
 *
 * Response: JSON sessions list with route, species, stats
 */

require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/WellnessCalculator.php';

header('Content-Type: application/json; charset=utf-8');

Auth::init();
$user = Auth::user();

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Login required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$period = $_GET['period'] ?? 'month';
if (!in_array($period, ['week', 'month', 'year', 'all'])) {
    $period = 'month';
}

$sessionIndex = isset($_GET['session_index']) ? (int)$_GET['session_index'] : null;

// WellnessCalculator からセッション一覧を取得
$summary = WellnessCalculator::getSummary($user['id'], $period);
$sessions = $summary['sessions'] ?? [];

// 特定セッションの詳細
if ($sessionIndex !== null) {
    if ($sessionIndex < 0 || $sessionIndex >= count($sessions)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Session not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    echo json_encode([
        'success' => true,
        'session' => $sessions[$sessionIndex],
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
    exit;
}

// セッション一覧（ルート情報は省略して軽量化）
$lightweight = array_map(function ($s) {
    unset($s['route'], $s['species']);
    return $s;
}, $sessions);

echo json_encode([
    'success'       => true,
    'sessions'      => $lightweight,
    'session_count'  => count($sessions),
    'physical'       => $summary['physical'] ?? [],
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
