<?php
/**
 * get_daily_quests.php — デイリークエストAPI
 *
 * 今日のクエスト3件 + 各進捗率を返す。
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/QuestManager.php';

Auth::init();
$user = Auth::user();

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'not_logged_in'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$userId = $user['id'];
$quests = QuestManager::getActiveQuests($userId);

$result = [];
foreach ($quests as $q) {
    $progress = QuestManager::checkProgress($userId, $q['id']);
    $result[] = [
        'id' => $q['id'],
        'icon' => $q['icon'] ?? '🎯',
        'title' => $q['title'] ?? $q['name'] ?? '',
        'description' => $q['description'] ?? '',
        'reward' => $q['reward'] ?? 100,
        'target' => $q['target'] ?? 1,
        'progress' => min($progress, 100),
        'completed' => $progress >= 100,
    ];
}

echo json_encode([
    'success' => true,
    'quests' => $result,
    'date' => date('Y-m-d'),
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
