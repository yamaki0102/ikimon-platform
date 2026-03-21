<?php
/**
 * Distribution Stats バッチ計算スクリプト
 *
 * 使用方法: php scripts/calc_distribution_stats.php
 * 推奨: 週次 cron で実行
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DistributionAnalyzer.php';

echo "=== Distribution Stats 再計算 ===\n";
echo "開始: " . date('Y-m-d H:i:s') . "\n\n";

$stats = DistributionAnalyzer::recalculate();

$totalSpecies = [];
$totalAreas = [];
foreach ($stats as $entry) {
    $totalSpecies[$entry['species_name']] = true;
    $totalAreas[$entry['area_name']] = true;
}

echo "種数: " . count($totalSpecies) . "\n";
echo "地域数: " . count($totalAreas) . "\n";
echo "種×地域ペア: " . count($stats) . "\n";

$rareCount = 0;
foreach ($stats as $entry) {
    if ($entry['count'] < 5) $rareCount++;
}
echo "珍しいペア（5件未満）: {$rareCount}\n";

echo "\n保存先: data/config/distribution_stats.json\n";
echo "完了: " . date('Y-m-d H:i:s') . "\n";
