<?php
/**
 * get_daily_quests.php — 後方互換ラッパー
 *
 * v2 マイゴールシステムへの移行済み。
 * 既存クライアント向けに、アクティブゴールをクエスト形式で返す。
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
$goalsWithProgress = QuestManager::getActiveGoalsWithProgress($userId);

$result = [];
foreach ($goalsWithProgress as $gp) {
    $goal = $gp['goal'];
    $progress = $gp['progress'];
    $result[] = [
        'id' => $goal['id'],
        'icon' => $goal['icon'] ?? 'target',
        'title' => $goal['title'] ?? '',
        'description' => $goal['description'] ?? '',
        'reward' => $goal['reward_per_milestone'] ?? 100,
        'target' => $progress['target'],
        'progress' => $progress['percent'],
        'completed' => $progress['completed'],
        'milestones' => $progress['milestones'],
        'milestones_completed' => $progress['milestones_completed'],
    ];
}

echo json_encode([
    'success' => true,
    'quests' => $result,
    'goals' => $result,
    'date' => date('Y-m-d'),
    'version' => 2,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
