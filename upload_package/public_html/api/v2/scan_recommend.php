<?php
/**
 * API v2: scan_recommend — 未踏エリア推薦
 *
 * GET /api/v2/scan_recommend.php
 *   ?lat=&lng=           (中心座標、必須)
 *   ?radius_km=5         (半径 km、省略時 5)
 *   ?install_id=         (FieldScan 端末認証、任意)
 *
 * プライバシー設計:
 *   - 個人軌跡・精密GPS座標は返さない
 *   - メッシュ中心座標 (約1km精度) のみ返す
 *   - スコアリングはサーバー側で完結（GBIF / iNat / ローカルデータ突合）
 *   - install_id は推薦パーソナライズのみに使用
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/ScanRecommendationEngine.php';
require_once ROOT_DIR . '/libs/DataStore.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, max-age=3600');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'GET required']);
    exit;
}

if (!api_rate_limit('scan_recommend', 10, 60)) {
    http_response_code(429);
    echo json_encode(['error' => 'Rate limit exceeded']);
    exit;
}

$lat = isset($_GET['lat']) ? (float)$_GET['lat'] : null;
$lng = isset($_GET['lng']) ? (float)$_GET['lng'] : null;

if ($lat === null || $lng === null || $lat === 0.0 || $lng === 0.0) {
    http_response_code(400);
    echo json_encode(['error' => 'lat/lng required']);
    exit;
}

if ($lat < 20 || $lat > 46 || $lng < 122 || $lng > 154) {
    http_response_code(400);
    echo json_encode(['error' => 'Coordinates out of Japan range']);
    exit;
}

$radiusKm = isset($_GET['radius_km']) ? max(1, min(20, (int)$_GET['radius_km'])) : 5;

Auth::init();
$userId = null;

if (Auth::isLoggedIn()) {
    $userId = Auth::user()['id'] ?? null;
} elseif (!empty($_GET['install_id'])) {
    $installId = $_GET['install_id'];
    $installs = DataStore::get('fieldscan_installs') ?? [];
    foreach ($installs as $inst) {
        if (($inst['install_id'] ?? '') === $installId && ($inst['status'] ?? 'active') === 'active') {
            $userId = $inst['user_id'];
            break;
        }
    }
}

try {
    $result = ScanRecommendationEngine::recommend($lat, $lng, $userId, $radiusKm);
} catch (Throwable $e) {
    error_log("[scan_recommend] Engine error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Recommendation engine unavailable']);
    exit;
}

$recommendations = $result['recommendations'] ?? [];
$summary = $result['summary'] ?? [];

// プライバシー: メッシュ中心座標のみ返す（bbox は削除、個人情報一切なし）
$safeRecs = array_map(function (array $rec): array {
    return [
        'mesh_code'     => $rec['mesh_code'],
        'center'        => $rec['center'],       // {lat, lng} ≈ 1km精度
        'score'         => $rec['score'],
        'priority'      => $rec['priority'],     // high / medium / low
        'reasons'       => $rec['reasons'],
        'external_species' => $rec['external_species'],
        'local_species' => $rec['local_species'],
        'coverage_gap'  => $rec['coverage_gap'],
        'last_scanned'  => $rec['last_scanned'],
        'environment'   => $rec['environment'] ?? ['label' => '不明', 'icon' => '📍'],
    ];
}, $recommendations);

echo json_encode([
    'recommendations' => $safeRecs,
    'summary' => [
        'total_recommendations' => count($safeRecs),
        'radius_km'             => $radiusKm,
        'coverage_rate'         => $summary['coverage_rate'] ?? 0,
        'gbif_species'          => $summary['gbif_species_in_area'] ?? 0,
        'inat_species'          => $summary['inat_species_in_area'] ?? 0,
        'ikimon_species'        => $summary['ikimon_species_in_area'] ?? 0,
    ],
], JSON_UNESCAPED_UNICODE);
