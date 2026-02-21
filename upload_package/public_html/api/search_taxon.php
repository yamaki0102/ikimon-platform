<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/TaxonSearchService.php';

$query = $_GET['q'] ?? '';
if (empty(trim($query))) {
    echo json_encode(['results' => []], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$locale = $_GET['locale'] ?? 'ja';
$limit  = min((int)($_GET['limit'] ?? 20), 50);

$results = TaxonSearchService::search($query, [
    'locale' => $locale,
    'limit'  => $limit,
]);

echo json_encode(['results' => $results], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
