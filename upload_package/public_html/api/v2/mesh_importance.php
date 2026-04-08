<?php
/**
 * API v2: Mesh Importance — メッシュ単位の生物多様性スコア付きGeoJSON
 *
 * GET /api/v2/mesh_importance.php
 *   ?lat_min=34.6&lng_min=137.6&lat_max=34.8&lng_max=137.9  (任意)
 *
 * mesh_aggregates に BIS スコア・成長段階をマージして返す。
 */
require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/MeshCode.php';
require_once ROOT_DIR . '/libs/MeshAggregator.php';
require_once ROOT_DIR . '/libs/MeshBiodiversityScorer.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('GET required', 405);
}

$latMin = api_param('lat_min', null, 'float');
$lngMin = api_param('lng_min', null, 'float');
$latMax = api_param('lat_max', null, 'float');
$lngMax = api_param('lng_max', null, 'float');

$hasBounds = ($latMin !== null && $lngMin !== null && $latMax !== null && $lngMax !== null);
$bounds = $hasBounds ? [$latMin, $lngMin, $latMax, $lngMax] : null;

// メッシュ集計データ
$meshData = $bounds
    ? MeshAggregator::getInBounds($latMin, $lngMin, $latMax, $lngMax)
    : MeshAggregator::getAll();

// スコアキャッシュ
$scores = MeshBiodiversityScorer::getAll();

// GeoJSON FeatureCollection を構築
$features = [];
foreach ($meshData as $code => $cell) {
    $topGroup = !empty($cell['by_group'])
        ? array_key_first(arsort_return($cell['by_group']))
        : null;

    $speciesList = [];
    $rawSpecies = $cell['species'] ?? [];
    uasort($rawSpecies, fn($a, $b) => $b['count'] <=> $a['count']);
    foreach (array_slice($rawSpecies, 0, 10, true) as $name => $sp) {
        $speciesList[] = [
            'name'  => $name,
            'sci'   => $sp['sci'] ?? '',
            'group' => $sp['group'] ?? 'その他',
            'count' => $sp['count'],
        ];
    }

    // スコア情報をマージ
    $scoreData = $scores[$code] ?? null;

    $properties = [
        'total'          => $cell['total'],
        'by_group'       => $cell['by_group'],
        'top_group'      => $topGroup,
        'group_count'    => count($cell['by_group']),
        'species_count'  => $scoreData['species_count'] ?? count($rawSpecies),
        'species'        => $speciesList,
        'first_obs'      => $cell['first_obs'] ?? null,
        'last_obs'       => $cell['last_obs'] ?? null,
        // BIS スコア
        'score'          => $scoreData['score'] ?? 0,
        'stage'          => $scoreData['stage'] ?? 'D',
        'stage_label'    => $scoreData['label'] ?? '発見',
        'richness'       => $scoreData['richness'] ?? 0,
        'conservation'   => $scoreData['conservation'] ?? 0,
        'coverage'       => $scoreData['coverage'] ?? 0,
        'confidence'     => $scoreData['confidence'] ?? 0,
        'effort'         => $scoreData['effort'] ?? 0,
        'red_list_count' => $scoreData['red_list_count'] ?? 0,
        'evaluation'     => $scoreData['evaluation'] ?? '',
    ];

    $features[] = MeshCode::toGeoJsonFeature($code, $properties);
}

// 統計サマリー
$summary = MeshBiodiversityScorer::getSummary();

header('Cache-Control: public, max-age=300');
echo json_encode([
    'type'     => 'FeatureCollection',
    'features' => $features,
    'summary'  => $summary,
], JSON_UNESCAPED_UNICODE);
