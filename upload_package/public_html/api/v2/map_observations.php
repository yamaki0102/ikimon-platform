<?php

/**
 * API v2: Map Observations — 公開 GeoJSON フィード
 *
 * GET /api/v2/map_observations.php
 *   - source: 'all' | 'post' | 'walk' | 'live-scan' (デフォルト: all)
 *   - min_tier: 最低 Evidence Tier (デフォルト: 1)
 *   - limit: 最大件数 (デフォルト: 1000)
 *   - bounds: 'lat1,lng1,lat2,lng2' (矩形フィルタ、任意)
 *
 * ログイン不要。誰でもアクセス可能。
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/CanonicalStore.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('Method not allowed', 405);
}

if (!api_rate_limit('map_observations', 30, 60)) {
    api_error('Rate limit exceeded', 429);
}

$source = api_param('source', 'all');
$minTier = api_param('min_tier', 1, 'float');
$limit = min(api_param('limit', 1000, 'int'), 5000);
$bounds = api_param('bounds', '');

// Canonical Schema からデータ取得
$dbPath = DATA_DIR . '/ikimon.db';
$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$sql = "
    SELECT
        o.occurrence_id, o.scientific_name, o.evidence_tier,
        o.observation_source, o.detection_confidence, o.adjusted_confidence,
        o.detection_model, o.created_at AS occ_created,
        e.event_date, e.decimal_latitude AS lat, e.decimal_longitude AS lng,
        e.sampling_protocol, e.recorded_by
    FROM occurrences o
    JOIN events e ON o.event_id = e.event_id
    WHERE o.evidence_tier >= :min_tier
      AND e.decimal_latitude IS NOT NULL
      AND e.decimal_longitude IS NOT NULL
";
$params = [':min_tier' => $minTier];

if ($source !== 'all') {
    $sql .= " AND o.observation_source = :source";
    $params[':source'] = $source;
}

if ($bounds) {
    $parts = explode(',', $bounds);
    if (count($parts) === 4) {
        $sql .= " AND e.decimal_latitude BETWEEN :lat1 AND :lat2 AND e.decimal_longitude BETWEEN :lng1 AND :lng2";
        $params[':lat1'] = floatval($parts[0]);
        $params[':lng1'] = floatval($parts[1]);
        $params[':lat2'] = floatval($parts[2]);
        $params[':lng2'] = floatval($parts[3]);
    }
}

$sql .= " ORDER BY o.created_at DESC LIMIT :lim";
$params[':lim'] = $limit;

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// GeoJSON 変換
$features = [];
foreach ($rows as $r) {
    $features[] = [
        'type' => 'Feature',
        'geometry' => [
            'type' => 'Point',
            'coordinates' => [floatval($r['lng']), floatval($r['lat'])],
        ],
        'properties' => [
            'id' => $r['occurrence_id'],
            'name' => $r['scientific_name'],
            'tier' => floatval($r['evidence_tier']),
            'source' => $r['observation_source'],
            'confidence' => $r['adjusted_confidence'] ? floatval($r['adjusted_confidence']) : floatval($r['detection_confidence']),
            'model' => $r['detection_model'],
            'date' => $r['event_date'],
        ],
    ];
}

// 統計
$stats = [
    'total' => count($features),
    'species' => count(array_unique(array_filter(array_column(array_column($features, 'properties'), 'name')))),
    'contributors' => (int)$pdo->query("SELECT COUNT(DISTINCT recorded_by) FROM events WHERE recorded_by IS NOT NULL")->fetchColumn(),
];

// 網羅度グリッド（~100m = 0.001度単位のセル）
$gridStmt = $pdo->query("
    SELECT
        ROUND(decimal_latitude, 3) AS grid_lat,
        ROUND(decimal_longitude, 3) AS grid_lng,
        COUNT(DISTINCT o.occurrence_id) AS obs_count,
        COUNT(DISTINCT o.scientific_name) AS species_count,
        MAX(e.event_date) AS last_survey
    FROM events e
    JOIN occurrences o ON e.event_id = o.event_id
    WHERE e.decimal_latitude IS NOT NULL AND e.decimal_longitude IS NOT NULL
    GROUP BY grid_lat, grid_lng
");
$grid = $gridStmt->fetchAll(PDO::FETCH_ASSOC);
$gridFeatures = [];
foreach ($grid as $g) {
    $gridFeatures[] = [
        'type' => 'Feature',
        'geometry' => ['type' => 'Point', 'coordinates' => [floatval($g['grid_lng']), floatval($g['grid_lat'])]],
        'properties' => [
            'obs' => (int)$g['obs_count'],
            'species' => (int)$g['species_count'],
            'last' => $g['last_survey'],
        ],
    ];
}
$stats['surveyed_cells'] = count($gridFeatures);

api_success([
    'type' => 'FeatureCollection',
    'features' => $features,
    'grid' => $gridFeatures,
    'stats' => $stats,
]);
