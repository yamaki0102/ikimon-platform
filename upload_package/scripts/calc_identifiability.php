<?php
/**
 * Identifiability Score バッチ計算スクリプト
 *
 * 使用方法: php scripts/calc_identifiability.php
 * 推奨: 週次 cron で実行
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/IdentifiabilityScorer.php';

echo "=== Identifiability Score 再計算 ===\n";
echo "開始: " . date('Y-m-d H:i:s') . "\n\n";

$scores = IdentifiabilityScorer::recalculate();

$difficult = 0;
foreach ($scores as $key => $entry) {
    $rate = $entry['correction_rate'];
    $symbol = $rate >= 0.40 ? '⚠' : '✓';
    $rank = $entry['recommended_rank'];
    printf(
        "  %s %-20s  修正率: %5.1f%%  サンプル: %3d  推奨: %s\n",
        $symbol,
        $entry['display_name'],
        $rate * 100,
        $entry['sample_size'],
        $rank
    );
    if ($rate >= 0.40) $difficult++;
}

echo "\n";
echo "合計分類群: " . count($scores) . "\n";
echo "写真同定困難: {$difficult}\n";
echo "保存先: data/config/identifiability_scores.json\n";
echo "完了: " . date('Y-m-d H:i:s') . "\n";
