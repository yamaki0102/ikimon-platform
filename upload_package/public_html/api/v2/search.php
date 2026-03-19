<?php

/**
 * API v2: Unified Search Endpoint
 *
 * 観察・種・文献を横断検索する統合 API。
 *
 * GET /api/v2/search.php?q=シジュウカラ&type=all&limit=20&offset=0
 *
 * パラメータ:
 *   q      (必須) 検索クエリ
 *   type   (任意) 検索対象: all, observations, species, literature (デフォルト: all)
 *   limit  (任意) 最大件数 (デフォルト: 20, 最大: 100)
 *   offset (任意) オフセット (デフォルト: 0)
 *   site   (任意) サイトIDでフィルタ
 *   grade  (任意) データ品質グレード (A/B/C/D)
 *   stage  (任意) 検証ステージ (unverified/ai_classified/human_verified/research_grade)
 *   from   (任意) 開始日 (YYYY-MM-DD)
 *   to     (任意) 終了日 (YYYY-MM-DD)
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/DataQuality.php';
require_once ROOT_DIR . '/libs/DataStageManager.php';
require_once ROOT_DIR . '/libs/PrivacyFilter.php';

// レート制限
if (!api_rate_limit('search', 30, 60)) {
    api_error('Rate limit exceeded. Please wait before trying again.', 429);
}

// --- パラメータ取得 ---
$query  = api_param('q');
$type   = api_param('type', 'all');
$limit  = min(api_param('limit', 20, 'int'), 100);
$offset = api_param('offset', 0, 'int');
$siteId = api_param('site');
$grade  = api_param('grade');
$stage  = api_param('stage');
$from   = api_param('from');
$to     = api_param('to');

if (empty($query)) {
    api_error('Query parameter "q" is required.', 400);
}

$validTypes = ['all', 'observations', 'species', 'literature'];
if (!in_array($type, $validTypes, true)) {
    api_error("Invalid type. Must be one of: " . implode(', ', $validTypes), 400);
}

// --- 検索実行 ---
$results = [
    'query' => $query,
    'type'  => $type,
];

$queryLower = mb_strtolower($query);

// 1. 観察検索
if ($type === 'all' || $type === 'observations') {
    $results['observations'] = searchObservations($queryLower, $limit, $offset, $siteId, $grade, $stage, $from, $to);
}

// 2. 種名検索
if ($type === 'all' || $type === 'species') {
    $results['species'] = searchSpecies($queryLower, $limit);
}

// 3. 文献検索
if ($type === 'all' || $type === 'literature') {
    $results['literature'] = searchLiterature($queryLower, $limit, $offset);
}

api_success($results, [
    'limit'  => $limit,
    'offset' => $offset,
]);

// === 検索関数 ===

function searchObservations(string $query, int $limit, int $offset, ?string $siteId, ?string $grade, ?string $stage, ?string $from, ?string $to): array
{
    $allObs = DataStore::fetchAll('observations');
    $matched = [];

    foreach ($allObs as $obs) {
        // テキストマッチ
        $searchableFields = [
            mb_strtolower($obs['species_name'] ?? ''),
            mb_strtolower($obs['taxon']['name'] ?? ''),
            mb_strtolower($obs['taxon']['scientific_name'] ?? ''),
            mb_strtolower($obs['notes'] ?? ''),
        ];

        $textMatch = false;
        foreach ($searchableFields as $field) {
            if ($field && mb_strpos($field, $query) !== false) {
                $textMatch = true;
                break;
            }
        }

        if (!$textMatch) continue;

        // フィルタ適用
        if ($siteId && ($obs['site_id'] ?? '') !== $siteId) continue;

        if ($grade) {
            $obsGrade = $obs['data_quality'] ?? DataQuality::calculate($obs);
            if ($obsGrade !== $grade) continue;
        }

        if ($stage) {
            $obsStage = DataStageManager::resolveStage($obs);
            if ($obsStage !== $stage) continue;
        }

        if ($from) {
            $obsDate = $obs['observed_at'] ?? '';
            if ($obsDate && $obsDate < $from) continue;
        }

        if ($to) {
            $obsDate = $obs['observed_at'] ?? '';
            if ($obsDate && $obsDate > $to . ' 23:59:59') continue;
        }

        // プライバシーフィルタ適用（Ambient レイヤー）
        $matched[] = PrivacyFilter::forAmbient($obs);
    }

    $total = count($matched);

    // 新しい順ソート
    usort($matched, function ($a, $b) {
        return strcmp($b['observed_at'] ?? '', $a['observed_at'] ?? '');
    });

    return [
        'items' => array_slice($matched, $offset, $limit),
        'total' => $total,
    ];
}

function searchSpecies(string $query, int $limit): array
{
    $allObs = DataStore::fetchAll('observations');
    $speciesMap = [];

    foreach ($allObs as $obs) {
        $name = $obs['taxon']['name'] ?? $obs['species_name'] ?? '';
        $sciName = $obs['taxon']['scientific_name'] ?? '';

        if (!$name && !$sciName) continue;

        $match = mb_strpos(mb_strtolower($name), $query) !== false
              || mb_strpos(mb_strtolower($sciName), $query) !== false;

        if (!$match) continue;

        $key = $sciName ?: $name;
        if (!isset($speciesMap[$key])) {
            $speciesMap[$key] = [
                'name'            => $name,
                'scientific_name' => $sciName,
                'group'           => $obs['taxon']['group'] ?? null,
                'lineage'         => $obs['taxon']['lineage'] ?? null,
                'observation_count' => 0,
                'last_observed'   => null,
            ];
        }
        $speciesMap[$key]['observation_count']++;
        $obsDate = $obs['observed_at'] ?? '';
        if ($obsDate > ($speciesMap[$key]['last_observed'] ?? '')) {
            $speciesMap[$key]['last_observed'] = $obsDate;
        }
    }

    // 観察数降順ソート
    uasort($speciesMap, fn($a, $b) => $b['observation_count'] <=> $a['observation_count']);

    return [
        'items' => array_values(array_slice($speciesMap, 0, $limit)),
        'total' => count($speciesMap),
    ];
}

function searchLiterature(string $query, int $limit, int $offset): array
{
    // PaperStore からのローカル検索
    if (!class_exists('PaperStore')) {
        require_once ROOT_DIR . '/libs/PaperStore.php';
    }

    $allPapers = PaperStore::fetchAll();
    $matched = [];

    foreach ($allPapers as $paper) {
        $searchable = mb_strtolower(
            ($paper['title'] ?? '') . ' ' .
            ($paper['abstract'] ?? '') . ' ' .
            implode(' ', $paper['authors'] ?? []) . ' ' .
            ($paper['journal'] ?? '')
        );

        if (mb_strpos($searchable, $query) !== false) {
            $matched[] = [
                'doi'     => $paper['doi'] ?? null,
                'title'   => $paper['title'] ?? '',
                'authors' => $paper['authors'] ?? [],
                'year'    => $paper['year'] ?? null,
                'journal' => $paper['journal'] ?? '',
                'source'  => $paper['source'] ?? 'unknown',
                'url'     => $paper['url'] ?? null,
            ];
        }
    }

    $total = count($matched);

    // 年降順
    usort($matched, fn($a, $b) => ($b['year'] ?? 0) <=> ($a['year'] ?? 0));

    return [
        'items' => array_slice($matched, $offset, $limit),
        'total' => $total,
    ];
}
