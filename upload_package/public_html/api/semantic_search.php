<?php

/**
 * Semantic Search API — ikimon.life
 *
 * Text search:  GET  /api/semantic_search.php?q=春の森の蝶&type=all&limit=10
 * Photo search: POST /api/semantic_search.php  (multipart: photo file, type, limit)
 *
 * Parameters:
 *   q      - Text search query (GET, min 2 chars)
 *   photo  - Photo file upload (POST, for visual similarity search)
 *   type   - observations|photos|papers|taxons|all (default: all)
 *   limit  - Max results per type (default: 10, max: 30)
 *
 * Response:
 * {
 *   "success": true,
 *   "results": {
 *     "observations": [{"id": "...", "score": 0.85, "observation": {...}}, ...],
 *     "photos": [{"id": "...", "score": 0.72, "observation": {...}}, ...],
 *     "papers": [{"id": "...", "score": 0.68, "paper": {...}}, ...],
 *     "taxons": [{"id": "...", "score": 0.55, "taxon": {...}}, ...]
 *   },
 *   "meta": { "query_type": "text"|"photo", "processing_ms": 45 }
 * }
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/EmbeddingService.php';
require_once __DIR__ . '/../../libs/EmbeddingStore.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/PaperStore.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$startTime = hrtime(true);

// ─── Rate Limiting (session-based, reuse ai_suggest pattern) ───
if (session_status() === PHP_SESSION_NONE) session_start();
$rateKey = 'semantic_search_requests';
$rateWindow = 60;
$rateLimit = 30;
$now = time();
$_SESSION[$rateKey] = array_filter(
    $_SESSION[$rateKey] ?? [],
    fn($t) => $t > $now - $rateWindow
);
if (count($_SESSION[$rateKey]) >= $rateLimit) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'rate_limit', 'message' => '検索回数制限に達しました。しばらくお待ちください。']);
    exit;
}
$_SESSION[$rateKey][] = $now;

// ─── Parse Parameters ──────────────────────────────────────────

$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$query = trim($_GET['q'] ?? ($_POST['q'] ?? ''));
$type = $_GET['type'] ?? ($_POST['type'] ?? 'all');
$limit = min(max((int) ($_GET['limit'] ?? ($_POST['limit'] ?? 10)), 1), 30);
$hasPhoto = $isPost && !empty($_FILES['photo']['tmp_name']);

$validTypes = ['observations', 'photos', 'papers', 'taxons', 'all'];
if (!in_array($type, $validTypes)) $type = 'all';

// Must have either text query or photo
if ($query === '' && !$hasPhoto) {
    echo json_encode(['success' => false, 'error' => 'missing_query', 'message' => 'q パラメータまたは photo ファイルが必要です。']);
    exit;
}
if ($query !== '' && mb_strlen($query) < 2) {
    echo json_encode(['success' => false, 'error' => 'query_too_short', 'message' => '2文字以上のクエリを入力してください。']);
    exit;
}

// ─── Generate Query Vector ─────────────────────────────────────

$svc = new EmbeddingService();
$queryVector = null;
$queryType = 'text';

if ($hasPhoto) {
    // Photo search: resize + embed image
    $queryType = 'photo';
    $tmpPath = $_FILES['photo']['tmp_name'];
    $photoData = EmbeddingService::resizePhoto($tmpPath);
    if ($photoData) {
        $queryVector = $svc->embedImage($photoData['data'], $photoData['mime']);
    }
} else {
    // Text search
    $queryVector = $svc->embedQuery($query);
}

if (!$queryVector) {
    http_response_code(502);
    echo json_encode(['success' => false, 'error' => 'embedding_failed', 'message' => 'クエリのembeddingに失敗しました。']);
    exit;
}

// ─── Search ────────────────────────────────────────────────────

$results = [];
$searchTypes = $type === 'all'
    ? ($queryType === 'photo' ? ['photos', 'observations'] : ['observations', 'papers', 'taxons'])
    : [$type];

foreach ($searchTypes as $sType) {
    $hits = EmbeddingStore::search($queryVector, $sType, $limit);

    // Enrich results with source data
    foreach ($hits as &$hit) {
        if ($sType === 'observations' || $sType === 'photos') {
            $obs = DataStore::findById('observations', $hit['id']);
            if ($obs) {
                $hit['observation'] = [
                    'id' => $obs['id'],
                    'photos' => $obs['photos'] ?? [],
                    'taxon' => $obs['taxon'] ?? null,
                    'status' => $obs['status'] ?? '',
                    'prefecture' => $obs['prefecture'] ?? '',
                    'municipality' => $obs['municipality'] ?? '',
                    'observed_at' => $obs['observed_at'] ?? '',
                    'user_name' => $obs['user_name'] ?? '',
                ];
            }
        } elseif ($sType === 'papers') {
            $paper = PaperStore::findById($hit['id'], 'id');
            if ($paper) {
                $hit['paper'] = [
                    'id' => $paper['id'] ?? '',
                    'doi' => $paper['doi'] ?? '',
                    'title' => $paper['title'] ?? '',
                    'authors' => $paper['authors'] ?? [],
                    'year' => $paper['year'] ?? null,
                ];
            }
        } elseif ($sType === 'taxons') {
            // Text already in the hit
            $hit['taxon'] = [
                'slug' => $hit['id'],
                'name' => $hit['text'] ?? '',
            ];
        }
    }

    $results[$sType] = $hits;
}

// ─── Response ──────────────────────────────────────────────────

$processingMs = (int) ((hrtime(true) - $startTime) / 1e6);

echo json_encode([
    'success' => true,
    'results' => $results,
    'meta' => [
        'query' => $query ?: '(photo)',
        'query_type' => $queryType,
        'type' => $type,
        'processing_ms' => $processingMs,
    ],
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
