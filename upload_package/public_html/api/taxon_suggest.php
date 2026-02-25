<?php

/**
 * Taxon Suggest API
 * 
 * Lightweight endpoint for autocomplete suggestions.
 * Searches local resolver with input normalization.
 * Falls back to iNaturalist if local results are insufficient.
 * 
 * GET ?q=メダ → returns matching species with slug + sci_name
 * Response: { results: [{ jp_name, sci_name, slug, rank, source, thumbnail_url }] }
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/TaxonSearchService.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=3600');

$q = trim($_GET['q'] ?? '');

if (mb_strlen($q) < 1) {
    echo json_encode(['results' => []], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// 入力正規化（全角→半角、カナ統一）
$normalized = TaxonSearchService::normalizeQuery($q);
if ($normalized === '') {
    echo json_encode(['results' => []], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$limit = 10;

// Load resolver (cached in OPcache on production)
$resolverFile = DATA_DIR . '/taxon_resolver.json';
$results = [];

if (file_exists($resolverFile)) {
    $resolver = json_decode(file_get_contents($resolverFile), true);
    $jpIndex = $resolver['jp_index'] ?? [];
    $taxa = $resolver['taxa'] ?? [];

    // 和名検索
    foreach ($jpIndex as $jpName => $slug) {
        if (str_starts_with($slug, '__jp__')) continue;
        if (mb_stripos($jpName, $normalized) === false) continue;

        $entry = $taxa[$slug] ?? [];
        $results[] = [
            'jp_name'  => $jpName,
            'sci_name' => $entry['accepted_name'] ?? '',
            'slug'     => $slug,
            'rank'     => $entry['rank'] ?? 'species',
            'source'   => 'local',
        ];
        if (count($results) >= $limit) break;
    }

    // 学名検索（和名で足りなかった場合）
    if (count($results) < $limit && preg_match('/^[a-zA-Z]/', $normalized)) {
        $seen = array_column($results, 'slug');
        foreach ($taxa as $slug => $entry) {
            if (in_array($slug, $seen)) continue;
            $sciName = $entry['accepted_name'] ?? '';
            if ($sciName && mb_stripos($sciName, $normalized) !== false) {
                $results[] = [
                    'jp_name'  => $entry['ja_name'] ?? '',
                    'sci_name' => $sciName,
                    'slug'     => $slug,
                    'rank'     => $entry['rank'] ?? 'species',
                    'source'   => 'local',
                ];
                if (count($results) >= $limit) break;
            }
        }
    }
}

// iNaturalist フォールバック（ローカル結果が不足の場合）
if (count($results) < 3) {
    $inatResults = TaxonSearchService::search($normalized, [
        'locale' => $_GET['locale'] ?? 'ja',
        'limit'  => $limit - count($results),
    ]);

    // ローカル結果と重複しないものだけ追加
    $seenSlugs = array_column($results, 'slug');
    foreach ($inatResults as $ir) {
        if (in_array($ir['slug'], $seenSlugs)) continue;
        $results[] = [
            'jp_name'       => $ir['ja_name'] ?? '',
            'sci_name'      => $ir['scientific_name'] ?? '',
            'slug'          => $ir['slug'] ?? '',
            'rank'          => $ir['rank'] ?? 'species',
            'source'        => $ir['source'] ?? 'inat',
            'thumbnail_url' => $ir['thumbnail_url'] ?? null,
            'inat_taxon_id' => $ir['inat_taxon_id'] ?? null,
        ];
        if (count($results) >= $limit) break;
    }
}

echo json_encode(['results' => $results], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
