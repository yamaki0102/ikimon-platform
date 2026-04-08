<?php
/**
 * rebuild_mesh_scores.php — 全メッシュの BIS スコアを一括再計算
 *
 * 使い方:
 *   php scripts/rebuild_mesh_scores.php
 *
 * MeshAggregator のキャッシュ（mesh_aggregates/current.json）から
 * 各メッシュセルのスコアを計算し mesh_scores/current.json に保存。
 */

require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/MeshBiodiversityScorer.php';

echo "=== Mesh Biodiversity Score Rebuild ===\n\n";

$start = microtime(true);

$scores = MeshBiodiversityScorer::buildAndCache();

$elapsed = round(microtime(true) - $start, 2);
$count = count($scores);

// 段階別集計
$byStage = array_fill_keys(array_keys(MeshBiodiversityScorer::STAGES), 0);
foreach ($scores as $s) {
    $byStage[$s['stage']]++;
}

echo "Scored {$count} mesh cells in {$elapsed}s\n\n";
echo "Stage breakdown:\n";
foreach (MeshBiodiversityScorer::STAGES as $stage => $def) {
    $n = $byStage[$stage];
    echo "  {$stage} ({$def['label']}): {$n}\n";
}
echo "\nCache saved to: data/mesh_scores/current.json\n";
