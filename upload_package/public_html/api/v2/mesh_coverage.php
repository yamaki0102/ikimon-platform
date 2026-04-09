<?php
/**
 * API v2: mesh_coverage — スキャン済みメッシュカバレッジ（コミュニティ集計）
 *
 * GET /api/v2/mesh_coverage.php
 *   ?sw_lat=&sw_lng=&ne_lat=&ne_lng=  (省略時: 全件)
 *   ?my=1  (自分のメッシュのみ — ログイン or install_id 必須)
 *
 * プライバシー設計:
 *   - コミュニティ集計は「メッシュ単位のスキャン回数」のみ返す（個人特定不可）
 *   - 個人軌跡・正確なGPS座標は一切返さない
 *   - my=1 は本人にのみ返す（ログイン or install_id 認証）
 *   - スキャン回数が1件のみのメッシュは community 表示では除外（k-匿名性）
 */

require_once __DIR__ . '/../bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/MeshAggregator.php';
require_once ROOT_DIR . '/libs/MeshCode.php';
require_once ROOT_DIR . '/libs/ContributionLedger.php';
require_once ROOT_DIR . '/libs/DataStore.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300'); // 5分キャッシュ

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'GET required']);
    exit;
}

if (!api_rate_limit('mesh_coverage', 30, 60)) {
    http_response_code(429);
    echo json_encode(['error' => 'Rate limit exceeded']);
    exit;
}

$swLat = isset($_GET['sw_lat']) ? (float)$_GET['sw_lat'] : null;
$swLng = isset($_GET['sw_lng']) ? (float)$_GET['sw_lng'] : null;
$neLat = isset($_GET['ne_lat']) ? (float)$_GET['ne_lat'] : null;
$neLng = isset($_GET['ne_lng']) ? (float)$_GET['ne_lng'] : null;
$myOnly = isset($_GET['my']) && $_GET['my'] === '1';

Auth::init();
$userId = null;

if (Auth::isLoggedIn()) {
    $userId = Auth::user()['id'] ?? null;
} elseif ($myOnly) {
    $installId = $_GET['install_id'] ?? null;
    if ($installId) {
        $installs = DataStore::get('fieldscan_installs') ?? [];
        foreach ($installs as $inst) {
            if (($inst['install_id'] ?? '') === $installId && ($inst['status'] ?? 'active') === 'active') {
                $userId = $inst['user_id'];
                break;
            }
        }
    }
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['error' => 'Auth required for my=1']);
        exit;
    }
}

$bounds = ($swLat && $swLng && $neLat && $neLng)
    ? [$swLat, $swLng, $neLat, $neLng]
    : null;

// --- コミュニティメッシュ集計（観察データから）---
$meshData = $bounds
    ? MeshAggregator::getInBounds($swLat, $swLng, $neLat, $neLng)
    : MeshAggregator::getAll();

// 上限 2000 メッシュ（レスポンスサイズ制御）
if (count($meshData) > 2000) {
    arsort($meshData);
    $meshData = array_slice($meshData, 0, 2000, true);
}

$features = [];
foreach ($meshData as $code => $cell) {
    $total = (int)($cell['total'] ?? 0);
    // k-匿名性: 1件のみのメッシュはコミュニティ表示から除外
    if ($total < 2) continue;

    [$s, $w, $n, $e] = $cell['bbox'];
    $features[] = [
        'type' => 'Feature',
        'properties' => [
            'mesh_code'   => $code,
            'scan_count'  => $total,           // スキャン回数
            'group_count' => count($cell['by_group'] ?? []), // 生物分類群の多様性
            'last_obs'    => $cell['last_obs'] ?? null,
            'freshness'   => self_freshness($cell['last_obs'] ?? null),
        ],
        'geometry' => [
            'type' => 'Polygon',
            'coordinates' => [[
                [$w, $s], [$e, $s], [$e, $n], [$w, $n], [$w, $s],
            ]],
        ],
    ];
}

// --- 自分のメッシュ踏破（my=1 かつ認証済み）---
$myMeshCodes = [];
if ($myOnly && $userId) {
    try {
        $ledger = ContributionLedger::getUserSummary($userId);
        $myMeshCodes = $ledger['mesh3_set'] ?? [];
    } catch (Throwable $e) {
        error_log("[mesh_coverage] ContributionLedger error: " . $e->getMessage());
    }
}

$totalCommunityMeshes = count($meshData);
$scannedCommunityMeshes = count($features);

echo json_encode([
    'type' => 'FeatureCollection',
    'features' => $features,
    'meta' => [
        'community_mesh_count' => $scannedCommunityMeshes,
        'my_mesh_count'        => count($myMeshCodes),
        'my_mesh_codes'        => $myOnly ? $myMeshCodes : [],
        'bounds_limited'       => $bounds !== null,
    ],
], JSON_UNESCAPED_UNICODE);

// フレッシュネス: 最終観察からの経過で 0.0〜1.0
function self_freshness(?string $lastObs): float {
    if (!$lastObs) return 0.0;
    $days = (time() - strtotime($lastObs)) / 86400;
    if ($days <= 7)  return 1.0;
    if ($days <= 30) return 0.8;
    if ($days <= 90) return 0.5;
    if ($days <= 180)return 0.3;
    return 0.1;
}
