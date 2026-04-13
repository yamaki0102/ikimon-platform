<?php

/**
 * 愛管エリア内の観察データを確認するスクリプト
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/SiteManager.php';

// 愛管サイトの境界を取得
$site = SiteManager::load('ikan_hq');
if (!$site) {
    echo "ERROR: ikan_hq site not found\n";
    exit(1);
}
$geometry = $site['features'][0]['geometry'] ?? null;
$center = $site['features'][0]['properties']['center'] ?? null;
echo "Site: " . ($site['features'][0]['properties']['name'] ?? 'N/A') . "\n";
echo "Center: " . json_encode($center) . "\n\n";

// 観察データを読み込み
$obs = DataStore::get('observations');
echo "Total observations: " . count($obs) . "\n";

// サンプル観察のキー構成
if (count($obs) > 0) {
    echo "Observation keys: " . implode(', ', array_keys($obs[0])) . "\n";
    echo "Sample observation:\n";
    echo json_encode($obs[0], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n\n";
}

// 愛管エリア内のものをカウント
$inArea = 0;
$inAreaObs = [];
foreach ($obs as $o) {
    $lat = (float)($o['lat'] ?? 0);
    $lng = (float)($o['lng'] ?? 0);
    if ($geometry && $lat && $lng) {
        if (SiteManager::isPointInGeometry($lat, $lng, $geometry)) {
            $inArea++;
            if (count($inAreaObs) < 3) {
                $inAreaObs[] = ['id' => $o['id'] ?? '', 'taxon' => $o['taxon_name'] ?? '', 'lat' => $lat, 'lng' => $lng];
            }
        }
    }
}
echo "Observations in ikan_hq area: {$inArea}\n";
if ($inAreaObs) {
    echo "Samples in area:\n";
    echo json_encode($inAreaObs, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
}
