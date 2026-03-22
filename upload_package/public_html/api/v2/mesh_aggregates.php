<?php
/**
 * API v2: Mesh Aggregates — メッシュ単位の生物多様性集計
 *
 * GET /api/v2/mesh_aggregates.php
 *   ?lat_min=34.6&lng_min=137.6&lat_max=34.8&lng_max=137.9  (任意: 表示エリアでフィルタ)
 *   ?format=geojson  (デフォルト)
 *
 * 大量observationsをスキャンせず、事前集計ファイルだけ返す。
 * データ量は観察数に依存しないため O(メッシュ数) で軽量。
 */
require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/MeshCode.php';
require_once ROOT_DIR . '/libs/MeshAggregator.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('GET required', 405);
}

$latMin = isset($_GET['lat_min']) ? (float)$_GET['lat_min'] : null;
$lngMin = isset($_GET['lng_min']) ? (float)$_GET['lng_min'] : null;
$latMax = isset($_GET['lat_max']) ? (float)$_GET['lat_max'] : null;
$lngMax = isset($_GET['lng_max']) ? (float)$_GET['lng_max'] : null;

$bounds = ($latMin && $lngMin && $latMax && $lngMax)
    ? [$latMin, $lngMin, $latMax, $lngMax]
    : null;

$geojson = MeshAggregator::toGeoJson($bounds);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60');
echo json_encode($geojson, JSON_UNESCAPED_UNICODE);
