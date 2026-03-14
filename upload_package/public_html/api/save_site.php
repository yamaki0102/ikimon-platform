<?php

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';
require_once __DIR__ . '/../../libs/SiteManager.php';
require_once __DIR__ . '/../../libs/CorporateAccess.php';
require_once __DIR__ . '/../../libs/CorporateManager.php';

header('Content-Type: application/json; charset=utf-8');

Auth::init();
$user = Auth::user();
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'POST only'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

CSRF::validateRequest();

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$siteId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($input['site_id'] ?? ''));
$name = trim((string)($input['name'] ?? ''));
$description = trim((string)($input['description'] ?? ''));
$address = trim((string)($input['address'] ?? ''));
$geometry = $input['geometry'] ?? null;
$ownerOrgId = trim((string)($input['owner_org_id'] ?? ''));

if ($siteId === '' || strlen($siteId) < 2 || strlen($siteId) > 64) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'site_id は2〜64文字の英数字で指定してください'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}
if ($name === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'サイト名を入力してください'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}
if (!$geometry || !isset($geometry['type'], $geometry['coordinates'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'エリアを地図上で描画してください'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}
if (!in_array((string)$geometry['type'], ['Polygon', 'MultiPolygon'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ジオメトリタイプはPolygonまたはMultiPolygonのみです'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$existingSite = SiteManager::load($siteId);
$isUpdate = $existingSite !== null;

if ($isUpdate) {
    if (!CorporateAccess::canEditSite($siteId, $user)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'この拠点を編集する権限がありません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }
    $ownerOrgId = trim((string)($existingSite['owner_org_id'] ?? $ownerOrgId));
} else {
    $manageable = CorporateAccess::getManageableCorporations($user);
    if (empty($manageable)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'サイトを作成できる団体ワークスペースがありません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }
    if ($ownerOrgId === '' && count($manageable) === 1) {
        $ownerOrgId = (string)($manageable[0]['id'] ?? '');
    }
    if ($ownerOrgId === '' || !CorporateAccess::canEditCorporation($ownerOrgId, $user)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => '保存先の団体ワークスペースを選択してください'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }
}

$corporation = $ownerOrgId !== '' ? CorporateManager::get($ownerOrgId) : null;
if (!$corporation) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => '団体ワークスペースが見つかりません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$allPoints = [];
if ($geometry['type'] === 'Polygon') {
    $allPoints = $geometry['coordinates'][0] ?? [];
} else {
    foreach ($geometry['coordinates'] as $polygon) {
        $allPoints = array_merge($allPoints, $polygon[0] ?? []);
    }
}
$center = [0, 0];
if (!empty($allPoints)) {
    $sumLng = 0;
    $sumLat = 0;
    foreach ($allPoints as $point) {
        $sumLng += (float)($point[0] ?? 0);
        $sumLat += (float)($point[1] ?? 0);
    }
    $count = count($allPoints);
    $center = [round($sumLng / $count, 6), round($sumLat / $count, 6)];
}

$createdAt = (string)($existingSite['created'] ?? date('Y-m-d'));
$createdBy = (string)($existingSite['created_by'] ?? ($user['id'] ?? $user['username'] ?? 'unknown'));
$geojson = [
    'type' => 'FeatureCollection',
    'features' => [[
        'type' => 'Feature',
        'properties' => [
            'site_id' => $siteId,
            'id' => $siteId,
            'name' => $name,
            'description' => $description,
            'address' => $address,
            'owner' => (string)($corporation['name'] ?? ''),
            'owner_org_id' => $ownerOrgId,
            'center' => $center,
            'status' => (string)($existingSite['status'] ?? 'active'),
            'created_by' => $createdBy,
            'created' => $createdAt,
            'updated' => date('Y-m-d'),
        ],
        'geometry' => $geometry,
    ]],
];

$siteDir = DATA_DIR . '/sites/' . $siteId;
if (!is_dir($siteDir)) {
    mkdir($siteDir, 0755, true);
}

$result = file_put_contents(
    $siteDir . '/boundary.geojson',
    json_encode($geojson, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG),
    LOCK_EX
);

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
        'name' => $name,
        'center' => $center,
        'owner_org_id' => $ownerOrgId,
    ],
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
