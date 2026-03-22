<?php

/**
 * API v2: Predict Species — 「次に出会える生物」予測
 *
 * GET /api/v2/predict_species.php?lat=34.71&lng=137.73
 *
 * 場所の環境文脈(GeoContext) + 季節 + OmoikaneDB → 出現予測
 * 過去のスキャンデータで補正（データ蓄積で精度向上）
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/OmoikaneSearchEngine.php';
require_once ROOT_DIR . '/libs/DataStore.php';

if (!api_rate_limit('predict_species', 10, 60)) {
    api_error('Rate limit exceeded', 429);
}

$lat = floatval($_GET['lat'] ?? 0);
$lng = floatval($_GET['lng'] ?? 0);

if (!$lat || !$lng) {
    api_error('lat/lng required', 400);
}

$month = intval(date('n'));
$hour = intval(date('G'));
$limit = min(10, max(1, intval($_GET['limit'] ?? 5)));

// --- GeoContext で環境を取得 ---
$geoCtx = null;
try {
    require_once ROOT_DIR . '/libs/GeoContext.php';
    $geoCtx = GeoContext::getContext($lat, $lng);
} catch (Throwable $e) {
    error_log("[predict_species] GeoContext error: " . $e->getMessage());
}

// --- 季節マッピング ---
$seasonMap = [
    1 => '冬', 2 => '冬', 3 => '春', 4 => '春', 5 => '春',
    6 => '夏', 7 => '夏', 8 => '夏', 9 => '秋', 10 => '秋',
    11 => '秋', 12 => '冬',
];
$season = $seasonMap[$month];

// --- 環境タイプから habitat キーワードを決定 ---
$habitatKeywords = [];
if ($geoCtx) {
    if ($geoCtx['nearest_water'] && $geoCtx['nearest_water']['distance_m'] < 300) {
        $habitatKeywords[] = '水辺';
        $habitatKeywords[] = '河川';
        $habitatKeywords[] = '湿地';
    }
    if ($geoCtx['nearest_park'] && $geoCtx['nearest_park']['distance_m'] < 100) {
        $habitatKeywords[] = '公園';
        $habitatKeywords[] = '都市';
    }
    $lu = $geoCtx['land_use'] ?? '';
    if (str_contains($lu, '森林')) {
        $habitatKeywords[] = '森林';
        $habitatKeywords[] = '林';
    }
    if (str_contains($lu, '農地')) {
        $habitatKeywords[] = '農地';
        $habitatKeywords[] = '田';
        $habitatKeywords[] = '畑';
    }
    if (!empty($geoCtx['green_features'])) {
        $habitatKeywords[] = '緑地';
    }
}
if (empty($habitatKeywords)) {
    $habitatKeywords = ['都市', '公園', '市街地'];
}

// --- OmoikaneDB で候補を検索 ---
$candidates = [];
try {
    $engine = new OmoikaneSearchEngine();

    foreach ($habitatKeywords as $hk) {
        $results = $engine->search([
            'habitat' => $hk,
            'season' => $season,
        ], 20);

        foreach ($results as $r) {
            $sciName = $r['scientific_name'] ?? '';
            if (!$sciName || isset($candidates[$sciName])) continue;

            $resolved = $engine->resolveByScientificName($sciName);
            $jaName = $resolved['japanese_name'] ?? $sciName;

            $candidates[$sciName] = [
                'name' => $jaName,
                'scientific_name' => $sciName,
                'habitat' => $r['habitat'] ?? '',
                'season' => $r['season'] ?? '',
                'morphological_traits' => $r['morphological_traits'] ?? '',
                'notes' => $r['notes'] ?? '',
                'habitat_match' => $hk,
                'base_score' => floatval($r['trust_score'] ?? 0.5),
            ];
        }
    }
} catch (Throwable $e) {
    error_log("[predict_species] OmoikaneDB error: " . $e->getMessage());
}

// --- 過去のスキャンデータで補正 ---
$nearbyHistory = [];
try {
    $allObs = DataStore::fetchAll('observations');
    foreach ($allObs as $o) {
        $oLat = floatval($o['location']['lat'] ?? $o['lat'] ?? 0);
        $oLng = floatval($o['location']['lng'] ?? $o['lng'] ?? 0);
        if (!$oLat || !$oLng) continue;
        if (abs($oLat - $lat) < 0.01 && abs($oLng - $lng) < 0.01) { // ~1km圏内
            $key = $o['taxon']['scientific_name'] ?? $o['taxon']['name'] ?? '';
            if ($key) {
                if (!isset($nearbyHistory[$key])) $nearbyHistory[$key] = 0;
                $nearbyHistory[$key]++;
            }
        }
    }
} catch (Throwable $e) {
    // データなしでも予測は可能
}

// --- スコア計算 ---
$predictions = [];
foreach ($candidates as $sciName => $c) {
    $score = $c['base_score'];

    // 過去データでの補正: 近くで実際に観察されていれば大幅ブースト
    if (isset($nearbyHistory[$sciName])) {
        $score += 0.3 + min(0.2, $nearbyHistory[$sciName] * 0.05);
    }

    // 季節一致ボーナス
    if ($c['season'] && str_contains($c['season'], $season)) {
        $score += 0.1;
    }

    $score = min(0.95, max(0.05, $score));

    $predictions[] = [
        'name' => $c['name'],
        'scientific_name' => $sciName,
        'probability' => round($score, 2),
        'habitat' => $c['habitat'],
        'season' => $c['season'],
        'note' => $c['morphological_traits'] ?: $c['notes'] ?: '',
        'habitat_match' => $c['habitat_match'],
        'observed_nearby' => isset($nearbyHistory[$sciName]),
        'nearby_count' => $nearbyHistory[$sciName] ?? 0,
    ];
}

// スコア降順
usort($predictions, fn($a, $b) => $b['probability'] <=> $a['probability']);
$predictions = array_slice($predictions, 0, $limit);

api_success([
    'predictions' => $predictions,
    'environment' => $geoCtx ? [
        'label' => $geoCtx['environment_label'],
        'icon' => $geoCtx['environment_icon'],
        'land_use' => $geoCtx['land_use'],
        'nearest_water' => $geoCtx['nearest_water'],
        'nearest_park' => $geoCtx['nearest_park'],
    ] : null,
    'season' => $season,
    'month' => $month,
    'disclaimer' => '予測はAIと過去データに基づく推定です。実際の出現を保証するものではありません。観察の際は私有地への立入にご注意ください。',
]);
