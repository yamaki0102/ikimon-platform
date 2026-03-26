<?php

/**
 * API v2: Observations Endpoint
 *
 * 観察データの取得・フィルタリング。
 * v1 の get_observations.php / get_last_observation.php / get_similar_observations.php を統合。
 *
 * GET /api/v2/observations.php                           → 最新の観察一覧
 * GET /api/v2/observations.php?id=obs_xxx                → 特定の観察
 * GET /api/v2/observations.php?user=user_123             → ユーザーの観察
 * GET /api/v2/observations.php?site=site_xxx             → サイト内の観察
 * GET /api/v2/observations.php?grade=A&stage=research_grade → フィルタ
 * GET /api/v2/observations.php?bbox=34.5,135.0,35.5,136.0 → 矩形範囲
 * GET /api/v2/observations.php?taxon=Parus+minor          → 種名検索
 * GET /api/v2/observations.php?action=stats               → 統計
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/DataQuality.php';
require_once ROOT_DIR . '/libs/DataStageManager.php';
require_once ROOT_DIR . '/libs/PrivacyFilter.php';

// レート制限
if (!api_rate_limit('observations', 60, 60)) {
    api_error('Rate limit exceeded.', 429);
}

// --- パラメータ ---
$action = api_param('action', 'list');
$id     = api_param('id');
$userId = api_param('user');
$siteId = api_param('site');
$grade  = api_param('grade');
$stage  = api_param('stage');
$taxon  = api_param('taxon');
$bbox   = api_param('bbox');
$from   = api_param('from');
$to     = api_param('to');
$sort   = api_param('sort', 'newest');
$limit  = min(api_param('limit', 20, 'int'), 100);
$offset = api_param('offset', 0, 'int');

// --- 単一観察の取得 ---
if ($id) {
    $obs = DataStore::findById('observations', $id);
    if (!$obs) {
        api_error('Observation not found.', 404);
    }

    // ステージを解決して付与
    $obs['verification_stage'] = DataStageManager::resolveStage($obs);
    $obs['data_quality'] = $obs['data_quality'] ?? DataQuality::calculate($obs);

    // プライバシーフィルタ（Ambient レイヤー）
    $filtered = PrivacyFilter::forAmbient($obs);
    api_success($filtered);
}

// --- 統計 ---
if ($action === 'stats') {
    $allObs = DataStore::fetchAll('observations');
    $stageSummary = DataStageManager::summarize($allObs);

    $gradeSummary = ['A' => 0, 'B' => 0, 'C' => 0, 'D' => 0];
    foreach ($allObs as $obs) {
        $g = $obs['data_quality'] ?? DataQuality::calculate($obs);
        $gradeSummary[$g] = ($gradeSummary[$g] ?? 0) + 1;
    }

    api_success([
        'total' => count($allObs),
        'by_stage' => $stageSummary,
        'by_grade' => $gradeSummary,
    ]);
}

// --- 一覧取得 ---
$allObs = DataStore::fetchAll('observations');
$filtered = [];

// BBox パース
$bboxParsed = null;
if ($bbox) {
    $parts = explode(',', $bbox);
    if (count($parts) === 4) {
        $bboxParsed = [
            'minLat' => (float) $parts[0],
            'minLng' => (float) $parts[1],
            'maxLat' => (float) $parts[2],
            'maxLng' => (float) $parts[3],
        ];
    }
}

foreach ($allObs as $obs) {
    // ユーザーフィルタ
    if ($userId && ($obs['user_id'] ?? '') !== $userId) continue;

    // サイトフィルタ
    if ($siteId && ($obs['site_id'] ?? '') !== $siteId) continue;

    // グレードフィルタ
    if ($grade) {
        $obsGrade = $obs['data_quality'] ?? DataQuality::calculate($obs);
        if ($obsGrade !== $grade) continue;
    }

    // ステージフィルタ
    if ($stage) {
        $obsStage = DataStageManager::resolveStage($obs);
        if ($obsStage !== $stage) continue;
    }

    // 種名フィルタ
    if ($taxon) {
        $taxonLower = mb_strtolower($taxon);
        $match = mb_strpos(mb_strtolower($obs['taxon']['name'] ?? ''), $taxonLower) !== false
              || mb_strpos(mb_strtolower($obs['taxon']['scientific_name'] ?? ''), $taxonLower) !== false
              || mb_strpos(mb_strtolower($obs['species_name'] ?? ''), $taxonLower) !== false;
        if (!$match) continue;
    }

    // BBoxフィルタ
    if ($bboxParsed) {
        $obsLat = $obs['lat'] ?? null;
        $obsLng = $obs['lng'] ?? null;
        if (!$obsLat || !$obsLng) continue;
        if ($obsLat < $bboxParsed['minLat'] || $obsLat > $bboxParsed['maxLat']) continue;
        if ($obsLng < $bboxParsed['minLng'] || $obsLng > $bboxParsed['maxLng']) continue;
    }

    // 日付フィルタ
    $obsDate = $obs['observed_at'] ?? '';
    if ($from && $obsDate < $from) continue;
    if ($to && $obsDate > $to . ' 23:59:59') continue;

    // ステージ・グレードを付与
    $obs['verification_stage'] = DataStageManager::resolveStage($obs);
    $obs['data_quality'] = $obs['data_quality'] ?? DataQuality::calculate($obs);

    $filtered[] = PrivacyFilter::forAmbient($obs);
}

// ソート
usort($filtered, function ($a, $b) use ($sort) {
    return match ($sort) {
        'oldest' => strcmp($a['observed_at'] ?? '', $b['observed_at'] ?? ''),
        'grade'  => strcmp($a['data_quality'] ?? 'D', $b['data_quality'] ?? 'D'),
        default  => strcmp($b['observed_at'] ?? '', $a['observed_at'] ?? ''),
    };
});

$total = count($filtered);
$items = array_slice($filtered, $offset, $limit);

api_success([
    'items' => $items,
    'total' => $total,
], [
    'limit'  => $limit,
    'offset' => $offset,
    'sort'   => $sort,
    'filters' => array_filter([
        'user' => $userId, 'site' => $siteId, 'grade' => $grade,
        'stage' => $stage, 'taxon' => $taxon, 'bbox' => $bbox,
        'from' => $from, 'to' => $to,
    ]),
]);
