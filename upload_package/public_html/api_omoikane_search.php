<?php

/**
 * API Endpoint: omoikane_search.php
 * Handles reverse-lookup queries from the frontend.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/OmoikaneSearchEngine.php';
// require_once __DIR__ . '/../libs/Auth.php'; // Depending on access rules, might be restricted

header('Content-Type: application/json');

// Try to read JSON body if applicable
$input = json_decode(file_get_contents('php://input'), true);

$filters = [
    'habitat' => $_GET['habitat'] ?? ($input['habitat'] ?? ''),
    'season' => $_GET['season'] ?? ($input['season'] ?? ''),
    'altitude' => $_GET['altitude'] ?? ($input['altitude'] ?? ''),
    'keyword' => $_GET['keyword'] ?? ($input['keyword'] ?? '')
];

$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : (isset($input['limit']) ? (int)$input['limit'] : 50);
$offset = isset($_GET['offset']) ? (int)$_GET['offset'] : (isset($input['offset']) ? (int)$input['offset'] : 0);

try {
    $engine = new OmoikaneSearchEngine();

    $start = microtime(true);
    $results = $engine->search($filters, $limit, $offset);
    $timeMs = (microtime(true) - $start) * 1000;

    echo json_encode([
        'success' => true,
        'filters' => $filters,
        'count' => count($results),
        'time_ms' => round($timeMs, 2),
        'results' => $results
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (\Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
