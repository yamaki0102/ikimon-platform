<?php

/**
 * API v2: Species Search — 自然言語で図鑑を検索
 *
 * GET /api/v2/species_search.php?q=赤くて小さい鳥
 *
 * Gemini Embedding 2 でクエリをベクトル化 → OmoikaneDB で類似検索
 * フォールバック: キーワードベース検索
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/OmoikaneSearchEngine.php';

if (!api_rate_limit('species_search', 20, 60)) {
    api_error('Rate limit exceeded', 429);
}

$query = trim($_GET['q'] ?? '');
if (!$query || mb_strlen($query) < 2) {
    api_error('Query too short', 400);
}

$limit = min(20, max(1, intval($_GET['limit'] ?? 10)));
$results = [];

// Strategy 1: Embedding ベクトル検索（精度高い）
$embeddingUsed = false;
try {
    require_once ROOT_DIR . '/libs/EmbeddingService.php';
    require_once ROOT_DIR . '/libs/EmbeddingStore.php';

    $service = new EmbeddingService();
    $queryVec = $service->embedQuery($query);

    if ($queryVec) {
        $matches = EmbeddingStore::search($queryVec, 'species', $limit, 0.25);
        if (!empty($matches)) {
            $engine = new OmoikaneSearchEngine();
            foreach ($matches as $m) {
                $resolved = $engine->resolveByScientificName($m['id']);
                if ($resolved) {
                    $traits = $engine->getTraitsByScientificName($m['id']);
                    $results[] = [
                        'name' => $resolved['japanese_name'] ?? $m['id'],
                        'scientific_name' => $m['id'],
                        'score' => $m['score'],
                        'habitat' => $traits['habitat'] ?? null,
                        'season' => $traits['season'] ?? null,
                        'morphological_traits' => $traits['morphological_traits'] ?? null,
                        'notes' => $traits['notes'] ?? null,
                        'method' => 'embedding',
                    ];
                }
            }
            $embeddingUsed = true;
        }
    }
} catch (Throwable $e) {
    error_log("[species_search] Embedding error: " . $e->getMessage());
}

// Strategy 2: キーワードフォールバック
if (empty($results)) {
    try {
        $engine = new OmoikaneSearchEngine();
        $keywordResults = $engine->search(['keyword' => $query], $limit);
        foreach ($keywordResults as $r) {
            $jaName = null;
            if (!empty($r['scientific_name'])) {
                $resolved = $engine->resolveByScientificName($r['scientific_name']);
                $jaName = $resolved['japanese_name'] ?? null;
            }
            $results[] = [
                'name' => $jaName ?? $r['scientific_name'] ?? '',
                'scientific_name' => $r['scientific_name'] ?? '',
                'score' => floatval($r['trust_score'] ?? 0),
                'habitat' => $r['habitat'] ?? null,
                'season' => $r['season'] ?? null,
                'morphological_traits' => $r['morphological_traits'] ?? null,
                'notes' => $r['notes'] ?? null,
                'method' => 'keyword',
            ];
        }
    } catch (Throwable $e) {
        error_log("[species_search] Keyword error: " . $e->getMessage());
    }
}

api_success([
    'query' => $query,
    'results' => $results,
    'count' => count($results),
    'method' => $embeddingUsed ? 'embedding' : 'keyword',
]);
