<?php

/**
 * API v2: Identifier Queue Endpoint
 *
 * 同定者向けスマートキューAPI。ユーザーの得意分類群に基づき
 * 最適な同定候補を優先順位付きで返す。
 *
 * GET /api/v2/identifier_queue.php?limit=20
 * GET /api/v2/identifier_queue.php?group=Aves&limit=10
 * GET /api/v2/identifier_queue.php?action=stats
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/DataQuality.php';
require_once ROOT_DIR . '/libs/IdentifierQueue.php';

// 認証必須
Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Authentication required.', 401);
}

$userId = Auth::getUserId();
$action = api_param('action', 'queue');

if ($action === 'stats') {
    // キュー全体の統計
    $stats = IdentifierQueue::getQueueStats();
    api_success($stats);
}

// デフォルト: パーソナライズドキュー
$limit = min(api_param('limit', 20, 'int'), 50);
$group = api_param('group');

$queue = $group
    ? IdentifierQueue::buildQueueForGroup($userId, $group, $limit)
    : IdentifierQueue::buildQueue($userId, $limit);

// レスポンス整形（観察データを軽量化）
$items = array_map(function ($item) {
    $obs = $item['observation'];
    return [
        'observation_id' => $obs['id'] ?? null,
        'species_name'   => $obs['species_name'] ?? ($obs['taxon']['name'] ?? ''),
        'scientific_name' => $obs['taxon']['scientific_name'] ?? '',
        'photos'         => array_slice($obs['photos'] ?? [], 0, 1), // サムネイル1枚
        'observed_at'    => $obs['observed_at'] ?? '',
        'location'       => [
            'lat' => $obs['lat'] ?? null,
            'lng' => $obs['lng'] ?? null,
        ],
        'existing_ids'   => count($obs['identifications'] ?? []),
        'ai_suggestion'  => $obs['ai_assessment']['taxon_name'] ?? null,
        'score'          => $item['score'],
        'reasons'        => $item['reasons'],
    ];
}, $queue);

api_success([
    'items' => $items,
    'total' => count($items),
], [
    'user_id' => $userId,
    'filter_group' => $group,
]);
