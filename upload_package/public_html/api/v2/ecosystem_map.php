<?php

/**
 * API v2: Ecosystem Map — エリア3D生態系モデル
 *
 * フィールドスキャンのデータを受信し、エリアの生態系モデルを構築・取得する。
 *
 * POST /api/v2/ecosystem_map.php — スキャンデータ送信
 * GET  /api/v2/ecosystem_map.php?area=xxx — エリアモデル取得
 * GET  /api/v2/ecosystem_map.php?area=xxx&format=geojson3d — 3D GeoJSON
 * GET  /api/v2/ecosystem_map.php?area=xxx&action=timeline — 時系列
 * GET  /api/v2/ecosystem_map.php?area=xxx&action=heatmap — ヒートマップ
 * GET  /api/v2/ecosystem_map.php?area=xxx&action=heatmap&taxon=シジュウカラ — 種別ヒートマップ
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/EcosystemMapper.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Authentication required.', 401);
}

$userId = Auth::getUserId();

// === POST: スキャンデータ送信 ===
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!api_rate_limit('ecosystem_post', 5, 60)) {
        api_error('Rate limit exceeded.', 429);
    }

    $body = api_json_body();
    $areaId = $body['area_id'] ?? null;
    $scanData = $body['scan_data'] ?? null;

    if (!$areaId || !$scanData) {
        api_error('area_id and scan_data are required.', 400);
    }

    // エリアID サニタイズ
    $areaId = preg_replace('/[^a-zA-Z0-9_-]/', '', $areaId);
    if (strlen($areaId) < 3 || strlen($areaId) > 64) {
        api_error('Invalid area_id. Must be 3-64 alphanumeric characters.', 400);
    }

    $model = EcosystemMapper::buildAreaModel($scanData, $areaId, $userId);

    api_success([
        'area_id' => $areaId,
        'biodiversity_score' => $model['biodiversity_score'],
        'total_species' => count($model['organisms']),
        'scan_count' => $model['scan_count'],
    ]);
}

// === GET: エリアモデル取得 ===
$areaId = api_param('area');
if (!$areaId) {
    api_error('area parameter is required.', 400);
}

$areaId = preg_replace('/[^a-zA-Z0-9_-]/', '', $areaId);
$action = api_param('action', 'model');
$format = api_param('format', 'json');

switch ($action) {
    case 'timeline':
        $timeline = EcosystemMapper::getTimeline($areaId);
        api_success($timeline);
        break;

    case 'heatmap':
        $taxon = api_param('taxon');
        $heatmap = EcosystemMapper::getHeatmap($areaId, $taxon);
        api_success($heatmap);
        break;

    default:
        if ($format === 'geojson3d') {
            $geojson = EcosystemMapper::toGeoJSON3D($areaId);
            api_success($geojson);
        } else {
            // フルモデル（簡略版、詳細は geojson3d で）
            $geojson = EcosystemMapper::toGeoJSON3D($areaId);
            api_success([
                'area_id' => $areaId,
                'properties' => $geojson['properties'],
                'species_list' => array_map(fn($f) => $f['properties'], array_filter(
                    $geojson['features'],
                    fn($f) => ($f['properties']['type'] ?? '') === 'organism'
                )),
            ]);
        }
}
