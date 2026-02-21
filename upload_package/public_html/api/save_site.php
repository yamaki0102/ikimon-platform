<?php

/**
 * API: Save/Create a site boundary
 * 
 * POST /api/save_site.php
 * Body: JSON { site_id, name, description, address, geojson }
 * 
 * Creates data/sites/{site_id}/boundary.geojson
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';

header('Content-Type: application/json; charset=utf-8');

// Auth check
Auth::init();
$user = Auth::user();
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'POST only'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Parse input
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$siteId      = preg_replace('/[^a-zA-Z0-9_-]/', '', $input['site_id'] ?? '');
$name        = trim($input['name'] ?? '');
$description = trim($input['description'] ?? '');
$address     = trim($input['address'] ?? '');
$geometry    = $input['geometry'] ?? null;

// Validation
if (!$siteId || strlen($siteId) < 2 || strlen($siteId) > 64) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'site_id は2〜64文字の英数字で指定してください'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (!$name) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'サイト名を入力してください'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (!$geometry || !isset($geometry['type']) || !isset($geometry['coordinates'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'エリアを地図上で描画してください'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Validate geometry type (Polygon or MultiPolygon)
if (!in_array($geometry['type'], ['Polygon', 'MultiPolygon'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ジオメトリタイプはPolygonまたはMultiPolygonのみです'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Calculate center
$allPoints = [];
if ($geometry['type'] === 'Polygon') {
    $allPoints = $geometry['coordinates'][0];
} elseif ($geometry['type'] === 'MultiPolygon') {
    foreach ($geometry['coordinates'] as $polygon) {
        $allPoints = array_merge($allPoints, $polygon[0]);
    }
}
$center = [0, 0];
if (!empty($allPoints)) {
    $sumLng = $sumLat = 0;
    foreach ($allPoints as $p) {
        $sumLng += $p[0];
        $sumLat += $p[1];
    }
    $n = count($allPoints);
    $center = [round($sumLng / $n, 6), round($sumLat / $n, 6)];
}

// Build GeoJSON FeatureCollection
$geojson = [
    'type' => 'FeatureCollection',
    'features' => [
        [
            'type' => 'Feature',
            'properties' => [
                'site_id'     => $siteId,
                'name'        => $name,
                'description' => $description,
                'address'     => $address,
                'center'      => $center,
                'status'      => 'active',
                'created_by'  => $user['id'] ?? $user['username'] ?? 'unknown',
                'created'     => date('Y-m-d'),
                'updated'     => date('Y-m-d'),
            ],
            'geometry' => $geometry,
        ]
    ]
];

// Save to disk
$siteDir = DATA_DIR . '/sites/' . $siteId;
if (!is_dir($siteDir)) {
    mkdir($siteDir, 0755, true);
}

$filePath = $siteDir . '/boundary.geojson';
$isUpdate = file_exists($filePath);

$result = file_put_contents($filePath, json_encode($geojson, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG));

if ($result === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => '保存に失敗しました'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => $isUpdate ? 'サイトを更新しました' : 'サイトを作成しました',
    'data' => [
        'site_id' => $siteId,
        'name'    => $name,
        'center'  => $center,
    ]
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
