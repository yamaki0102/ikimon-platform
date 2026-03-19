<?php
/**
 * get_growth_log.php — 成長ログAPI
 *
 * ユーザーの観察力変化の月次推移と成長メッセージを返す。
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/GrowthTracker.php';

Auth::init();
$user = Auth::user();

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'not_logged_in'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$userId = $user['id'];

// スナップショットを更新（月1回自動）
$current = GrowthTracker::updateSnapshot($userId);

// 履歴取得
$history = GrowthTracker::getHistory($userId);

// 成長メッセージ生成
$messages = GrowthTracker::generateMessages($userId);

echo json_encode([
    'success' => true,
    'current' => $current['metrics'] ?? [],
    'history' => $history,
    'messages' => $messages,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
