<?php

/**
 * API Endpoint: api_omoikane_search.php
 *
 * Dual-mode search over the Omoikane knowledge graph:
 *
 *   MODE 1: Reverse-lookup (structural filter, default)
 *     Parameters: habitat, season, altitude, keyword, limit, offset
 *     Engine: OmoikaneSearchEngine → SQLite WHERE/LIKE
 *
 *   MODE 2: Semantic search
 *     Parameters: q (natural language query), limit
 *     Engine: EmbeddingService → EmbeddingStore cosine similarity (type='omoikane')
 *     Requires: embed_omoikane_species.php to have been run first
 *
 *   MODE 3: Hybrid (both modes, results merged by score)
 *     Parameters: q + any filter param
 *
 * Usage:
 *   GET /api_omoikane_search.php?habitat=forest&season=spring
 *   GET /api_omoikane_search.php?q=冬に低山で見られる赤い実のなる木
 *   GET /api_omoikane_search.php?q=ヤマビル&habitat=forest&season=summer
 *   POST with JSON body: {"q":"...", "habitat":"...", "limit": 20}
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/OmoikaneSearchEngine.php';
require_once __DIR__ . '/../libs/EmbeddingService.php';
require_once __DIR__ . '/../libs/EmbeddingStore.php';

header('Content-Type: application/json; charset=utf-8');

// ─── Parse input ────────────────────────────────────────────────────────────

$body  = json_decode(file_get_contents('php://input'), true) ?: [];
$get   = $_GET;

$q       = trim((string) ($get['q']       ?? $body['q']       ?? ''));
$habitat = trim((string) ($get['habitat'] ?? $body['habitat'] ?? ''));
$season  = trim((string) ($get['season']  ?? $body['season']  ?? ''));
$altitude = trim((string)($get['altitude'] ?? $body['altitude'] ?? ''));
$keyword = trim((string) ($get['keyword'] ?? $body['keyword'] ?? ''));
$limit   = max(1, min(200, (int) ($get['limit']  ?? $body['limit']  ?? 50)));
$offset  = max(0,          (int) ($get['offset'] ?? $body['offset'] ?? 0));
$minScore = (float) ($get['min_score'] ?? $body['min_score'] ?? 0.3);

// Determine mode
$hasStructuralFilter = $habitat !== '' || $season !== '' || $altitude !== '' || $keyword !== '';
$hasSemanticQuery    = $q !== '';

$mode = match (true) {
    $hasSemanticQuery && $hasStructuralFilter => 'hybrid',
    $hasSemanticQuery                          => 'semantic',
    default                                    => 'reverse_lookup',
};

// ─── Execute ─────────────────────────────────────────────────────────────────

try {
    $start = microtime(true);

    $structuralResults = [];
    $semanticResults   = [];

    // ── Structural (reverse-lookup) ──────────────────────────────
    if ($mode === 'reverse_lookup' || $mode === 'hybrid') {
        $engine = new OmoikaneSearchEngine();
        $filters = compact('habitat', 'season', 'altitude', 'keyword');
        $structuralResults = $engine->search(array_filter($filters), $limit, $offset);

        // Normalize: add score field (trust_score used as proxy)
        foreach ($structuralResults as &$r) {
            $r['_score']  = (float) ($r['trust_score'] ?? 0.0);
            $r['_source'] = 'structural';
        }
        unset($r);
    }

    // ── Semantic ─────────────────────────────────────────────────
    if ($mode === 'semantic' || $mode === 'hybrid') {
        $embeddingCount = EmbeddingStore::count('omoikane');

        if ($embeddingCount === 0) {
            // Graceful degradation: fall back to keyword search if embeddings not generated yet
            if ($mode === 'semantic') {
                echo json_encode([
                    'success' => true,
                    'mode'    => 'semantic_unavailable',
                    'message' => 'Omoikane embeddings not yet generated. Run scripts/embed_omoikane_species.php first.',
                    'count'   => 0,
                    'results' => [],
                ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
                exit;
            }
            // In hybrid mode: just use structural results
        } else {
            $service     = new EmbeddingService();
            $queryVector = $service->embedQuery($q);

            if ($queryVector === null) {
                if ($mode === 'semantic') {
                    http_response_code(503);
                    echo json_encode([
                        'success' => false,
                        'error'   => 'Failed to generate query embedding. Check GEMINI_API_KEY.',
                    ], JSON_UNESCAPED_UNICODE);
                    exit;
                }
                // Hybrid: skip semantic, rely on structural
            } else {
                $hits = EmbeddingStore::search($queryVector, 'omoikane', $limit * 2, $minScore);

                // Enrich semantic hits with species detail from Omoikane DB
                if (!empty($hits)) {
                    $db  = new OmoikaneDB();
                    $pdo = $db->getPDO();

                    $ids = array_column($hits, 'id');
                    $placeholders = implode(',', array_fill(0, count($ids), '?'));

                    $detailStmt = $pdo->prepare("
                        SELECT
                            s.id, s.scientific_name, s.japanese_name,
                            e.habitat, e.altitude, e.season, e.notes,
                            k.morphological_traits, k.similar_species, k.key_differences,
                            COALESCE(ts.trust_score, 0.0) AS trust_score
                        FROM species s
                        LEFT JOIN ecological_constraints e ON s.id = e.species_id
                        LEFT JOIN identification_keys k    ON s.id = k.species_id
                        LEFT JOIN trust_scores ts          ON s.id = ts.species_id
                        WHERE s.id IN ({$placeholders})
                    ");
                    $detailStmt->execute($ids);
                    $detailMap = [];
                    foreach ($detailStmt->fetchAll(PDO::FETCH_ASSOC) as $d) {
                        $detailMap[(string) $d['id']] = $d;
                    }

                    foreach ($hits as $hit) {
                        $detail = $detailMap[$hit['id']] ?? null;
                        $semanticResults[] = array_merge(
                            $detail ?? ['id' => $hit['id'], 'scientific_name' => $hit['text']],
                            [
                                '_score'          => $hit['score'],
                                '_source'         => 'semantic',
                                'semantic_score'  => $hit['score'],
                            ]
                        );
                    }
                }
            }
        }
    }

    // ── Merge & rank (hybrid) ────────────────────────────────────
    $results = [];
    if ($mode === 'hybrid') {
        // Index semantic results by species ID for merging
        $semanticById = [];
        foreach ($semanticResults as $r) {
            $semanticById[(string) $r['id']] = $r;
        }

        foreach ($structuralResults as $r) {
            $sid = (string) $r['id'];
            if (isset($semanticById[$sid])) {
                // Boost: appears in both → higher combined score
                $r['_score']         = $r['_score'] + $semanticById[$sid]['semantic_score'] * 0.5;
                $r['semantic_score'] = $semanticById[$sid]['semantic_score'];
                $r['_source']        = 'hybrid';
                unset($semanticById[$sid]);
            }
            $results[] = $r;
        }
        // Add semantic-only results
        foreach ($semanticById as $r) {
            $results[] = $r;
        }
        usort($results, fn($a, $b) => $b['_score'] <=> $a['_score']);
        $results = array_slice($results, 0, $limit);
    } elseif ($mode === 'semantic') {
        $results = array_slice($semanticResults, 0, $limit);
    } else {
        $results = $structuralResults;
    }

    $timeMs = round((microtime(true) - $start) * 1000, 2);

    echo json_encode([
        'success'  => true,
        'mode'     => $mode,
        'filters'  => array_filter(compact('q', 'habitat', 'season', 'altitude', 'keyword')),
        'count'    => count($results),
        'time_ms'  => $timeMs,
        'results'  => $results,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
