<?php

/**
 * Get Similar Observations API
 *
 * Returns observations with similar embedding vectors (semantic similarity).
 *
 * GET /api/get_similar_observations.php?id=OBS_ID&limit=6
 *
 * Response:
 * {
 *   "success": true,
 *   "observations": [
 *     {"id": "...", "score": 0.85, "photos": [...], "taxon": {...}, ...},
 *     ...
 *   ]
 * }
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/EmbeddingStore.php';
require_once __DIR__ . '/../../libs/EmbeddingService.php';
require_once __DIR__ . '/../../libs/DataStore.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$id = trim($_GET['id'] ?? '');
$limit = min(max((int) ($_GET['limit'] ?? 6), 1), 20);

if ($id === '') {
    echo json_encode(['success' => false, 'error' => 'missing_id']);
    exit;
}

// Find similar vectors in both observations and photos stores
$hits = EmbeddingStore::findSimilar('observations', $id, $limit, 0.3);

if (empty($hits)) {
    // Try photo-based similarity as fallback
    $hits = EmbeddingStore::findSimilar('photos', $id, $limit, 0.3);
}

// Enrich with observation data
$results = [];
$seen = [];
foreach ($hits as $hit) {
    $obsId = $hit['id'];
    if (isset($seen[$obsId]) || $obsId === $id) continue;
    $seen[$obsId] = true;

    $obs = DataStore::findById('observations', $obsId);
    if (!$obs) continue;

    $results[] = [
        'id' => $obs['id'],
        'score' => $hit['score'],
        'photos' => array_slice($obs['photos'] ?? [], 0, 1),
        'taxon' => $obs['taxon'] ?? null,
        'prefecture' => $obs['prefecture'] ?? '',
        'municipality' => $obs['municipality'] ?? '',
        'observed_at' => $obs['observed_at'] ?? '',
        'user_name' => $obs['user_name'] ?? '',
    ];

    if (count($results) >= $limit) break;
}

echo json_encode([
    'success' => true,
    'observations' => $results,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
