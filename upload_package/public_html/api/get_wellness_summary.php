<?php

/**
 * API: Get Wellness Summary
 *
 * ユーザーのウェルネス指標（自然滞在時間・歩行距離・認知指標）を返す。
 * 既存の観察データから自動計算。新しいデータ入力は不要。
 *
 * GET params:
 *   - period: week | month | year | all (default: month)
 *
 * Response: JSON wellness summary
 */

require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/WellnessCalculator.php';
require_once ROOT_DIR . '/libs/Cache.php';

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

// キャッシュ: 10分（観察データの更新頻度を考慮）
$cacheKey = "wellness_{$user['id']}_{$period}";
$summary = Cache::get($cacheKey, 600);
if ($summary === null) {
    $summary = WellnessCalculator::getSummary($user['id'], $period);
    Cache::set($cacheKey, $summary, 600);
}

echo json_encode([
    'success' => true,
    'data'    => $summary,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
