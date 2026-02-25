<?php

/**
 * E2E 検証スクリプト — ダッシュボード + レポート
 * (cURL未使用版 — file_get_contents使用)
 */

echo "=== E2E 検証: ikan_hq ===\n\n";

// ── Dashboard ──
echo "1. Dashboard (site_dashboard.php?site=ikan_hq)\n";
$context = stream_context_create(['http' => ['timeout' => 10]]);
$html = @file_get_contents('http://localhost:8899/site_dashboard.php?site=ikan_hq', false, $context);

if ($html === false) {
    echo "   ❌ Could not fetch dashboard (server not running?)\n";
} else {
    echo "   HTTP Status: 200 ✅\n";
    echo "   Body Length: " . strlen($html) . " bytes\n";
    if (preg_match('/<title>(.*?)<\/title>/s', $html, $m)) {
        echo "   Title: " . trim($m[1]) . "\n";
    }
    echo "   Has chart: " . (stripos($html, 'chart') !== false ? '✅' : '❌') . "\n";
    echo "   Has map: " . (stripos($html, 'map') !== false ? '✅' : '❌') . "\n";
    echo "   Has 観察: " . (mb_strpos($html, '観察') !== false ? '✅' : '❌') . "\n";
    echo "   Has 種: " . (mb_strpos($html, '種') !== false ? '✅' : '❌') . "\n";
    echo "   Has レッドリスト: " . (mb_strpos($html, 'レッドリスト') !== false || stripos($html, 'redlist') !== false ? '✅' : '❌') . "\n";
}

// ── Report ──
echo "\n2. Report (api/generate_site_report.php?site_id=ikan_hq)\n";
$reportHtml = @file_get_contents('http://localhost:8899/api/generate_site_report.php?site_id=ikan_hq', false, $context);

if ($reportHtml === false) {
    echo "   ❌ Could not fetch report\n";
} else {
    echo "   HTTP Status: 200 ✅\n";
    echo "   Body Length: " . strlen($reportHtml) . " bytes\n";
    if (preg_match('/<title>(.*?)<\/title>/s', $reportHtml, $m)) {
        echo "   Title: " . trim($m[1]) . "\n";
    }
    echo "   Has BIS: " . (stripos($reportHtml, 'BIS') !== false ? '✅' : '❌') . "\n";
    echo "   Has TNFD/LEAP: " . (stripos($reportHtml, 'TNFD') !== false || stripos($reportHtml, 'LEAP') !== false ? '✅' : '❌') . "\n";
    echo "   Has 種 list: " . (mb_strpos($reportHtml, '種') !== false ? '✅' : '❌') . "\n";
    echo "   Has レッドリスト: " . (mb_strpos($reportHtml, 'レッドリスト') !== false || stripos($reportHtml, 'redlist') !== false ? '✅' : '❌') . "\n";
    echo "   Has 月 trend: " . (mb_strpos($reportHtml, '月') !== false ? '✅' : '❌') . "\n";
    echo "   Has 愛管: " . (mb_strpos($reportHtml, '愛管') !== false ? '✅' : '❌') . "\n";
}

// ── Data Integrity ──
echo "\n3. Data Integrity Check\n";
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/SiteManager.php';

$site = SiteManager::load('ikan_hq');
$geometry = $site['geometry'] ?? null;
$obs = DataStore::get('observations');
$seedCount = 0;
$inBoundary = 0;
$speciesSet = [];
foreach ($obs as $o) {
    if (isset($o['is_seed']) && $o['is_seed'] && strpos($o['user_id'] ?? '', 'seed_aikan') !== false) {
        $seedCount++;
        $speciesSet[$o['taxon_name'] ?? ''] = true;
        $lat = (float)($o['lat'] ?? 0);
        $lng = (float)($o['lng'] ?? 0);
        if ($geometry && SiteManager::isPointInGeometry($lat, $lng, $geometry)) {
            $inBoundary++;
        }
    }
}
echo "   Seed observations: {$seedCount}\n";
echo "   Unique species: " . count($speciesSet) . "\n";
echo "   Within boundary: {$inBoundary}/{$seedCount}\n";
echo "   All within boundary: " . ($inBoundary === $seedCount ? '✅' : '❌') . "\n";
echo "   Total observations: " . count($obs) . "\n";

echo "\n=== E2E 検証完了 ===\n";
