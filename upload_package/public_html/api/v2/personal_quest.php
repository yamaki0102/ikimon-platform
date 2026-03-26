<?php
/**
 * Personal Quest API — Phase 16
 *
 * GET /api/v2/personal_quest.php?lat=35.6&lng=139.7
 *
 * GPT-5.4 nano がユーザー個別の今日のクエストを生成
 */

require_once __DIR__ . '/../../../config/config.php';
require_once __DIR__ . '/../../../libs/Auth.php';
require_once __DIR__ . '/../../../libs/QuestManager.php';
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('Method not allowed', 405);
}

session_start();
$userId = $_SESSION['user_id'] ?? '';
if (empty($userId)) {
    api_error('Login required', 401);
}

$lat = api_param('lat', null, 'float');
$lng = api_param('lng', null, 'float');

if ($lat === null || $lng === null) {
    api_error('lat and lng are required', 400);
}

api_rate_limit('personal_quest', 3, 300);

$quest = QuestManager::generatePersonalQuest($userId, $lat, $lng);

if ($quest === null) {
    api_error('クエスト生成に失敗しました', 503);
}

$chains = QuestManager::generateSeasonalChains($userId);
$activeChains = QuestManager::getUserChains($userId);
$activeChains = array_filter($activeChains, fn($c) => empty($c['completed_at']));

api_success([
    'personal_quest' => $quest,
    'chains' => array_values($activeChains),
    'new_chains' => $chains,
]);
