<?php

/**
 * API: Get Site Wellness Summary
 *
 * サイトに紐づく全ユーザーの観察データからウェルネス指標を集計。
 * 個人を特定しない匿名化統計を返す。
 *
 * GET params:
 *   - site_id: (required) サイトID
 *   - period: week | month | year | all (default: month)
 *
 * Response: JSON with aggregated wellness stats
 */

require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/SiteManager.php';
require_once ROOT_DIR . '/libs/WellnessCalculator.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/Cache.php';

header('Content-Type: application/json; charset=utf-8');

Auth::init();

$siteId = $_GET['site_id'] ?? '';
$period = $_GET['period'] ?? 'month';
if (!in_array($period, ['week', 'month', 'year', 'all'])) {
    $period = 'month';
}

if (empty($siteId)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'site_id required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// キャッシュ（15分TTL — サイト集計は重いため）
$cacheKey = "site_wellness_{$siteId}_{$period}";
$cached = Cache::get($cacheKey);
if ($cached !== null) {
    echo json_encode(['success' => true, 'data' => $cached], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// サイトの存在確認
$site = SiteManager::load($siteId);
if (!$site) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Site not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// サイトに関連するユーザーを特定（そのサイト内に投稿がある全ユーザー）
$allObs = DataStore::fetchAll('observations');
$siteObserverIds = [];

foreach ($allObs as $obs) {
    $obsSiteId = $obs['site_id'] ?? '';
    if ($obsSiteId !== $siteId) continue;
    $userId = $obs['user_id'] ?? '';
    if ($userId) {
        $siteObserverIds[$userId] = true;
    }
}

$uniqueObservers = array_keys($siteObserverIds);

// 各ユーザーのウェルネスを計算し匿名集計
$totalNatureMinutes = 0;
$totalSessions = 0;
$totalCognitive = 0;
$totalSpecies = 0;
$totalStreakDays = 0;
$weeklyAchievedCount = 0;
$userCount = count($uniqueObservers);

foreach ($uniqueObservers as $userId) {
    $summary = WellnessCalculator::getSummary($userId, $period);

    $totalNatureMinutes += $summary['physical']['total_nature_minutes'] ?? 0;
    $totalSessions += $summary['physical']['session_count'] ?? 0;
    $totalCognitive += $summary['cognitive']['cognitive_engagement'] ?? 0;
    $totalSpecies += $summary['emotional']['lifelist_total'] ?? 0;
    $totalStreakDays += $summary['emotional']['streak_days'] ?? 0;

    // 今週120分達成者カウント
    $weeklyNature = $summary['weekly_nature'] ?? [];
    if (!empty($weeklyNature)) {
        $currentWeek = end($weeklyNature);
        if ($currentWeek['achieved'] ?? false) {
            $weeklyAchievedCount++;
        }
    }
}

$avgCognitive = $userCount > 0 ? round($totalCognitive / $userCount) : 0;
$avgNatureMinutes = $userCount > 0 ? round($totalNatureMinutes / $userCount) : 0;
$achievementRate = $userCount > 0 ? round($weeklyAchievedCount / $userCount * 100) : 0;

$result = [
    'site_id' => $siteId,
    'period' => $period,
    'participant_count' => $userCount,
    'aggregate' => [
        'total_nature_minutes' => $totalNatureMinutes,
        'avg_nature_minutes' => $avgNatureMinutes,
        'total_sessions' => $totalSessions,
        'avg_cognitive_score' => $avgCognitive,
        'total_species_discovered' => $totalSpecies,
        'weekly_120min_achievement_rate' => $achievementRate,
        'weekly_120min_achieved_count' => $weeklyAchievedCount,
    ],
    'generated_at' => date('c'),
];

Cache::set($cacheKey, $result, 900); // 15分キャッシュ

echo json_encode(['success' => true, 'data' => $result], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
