<?php
/**
 * rebuild_mesh_aggregates.php — 既存observationsからメッシュ集計を再構築
 *
 * Usage: php scripts/rebuild_mesh_aggregates.php [--dry-run]
 *
 * 通常運用では passive_event.php が差分更新するため不要。
 * 初回セットアップ・データ修復時に実行する。
 */
$dry = in_array('--dry-run', $argv ?? []);

require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/MeshCode.php';
require_once ROOT_DIR . '/libs/MeshAggregator.php';

echo "=== Mesh Aggregate Rebuild ===\n";
if ($dry) echo "[DRY RUN]\n";

$outPath = DATA_DIR . '/mesh_aggregates/current.json';

if (!$dry && file_exists($outPath)) {
    unlink($outPath);
    echo "Cleared existing: $outPath\n";
}

echo "Loading observations...\n";
$allObs = DataStore::fetchAll('observations');
$total = count($allObs);
echo "Found: $total observations\n";

$processed = 0;
$skipped   = 0;

foreach ($allObs as $obs) {
    $lat = (float)($obs['lat'] ?? $obs['location']['lat'] ?? 0);
    $lng = (float)($obs['lng'] ?? $obs['location']['lng'] ?? 0);
    if (!$lat || !$lng) { $skipped++; continue; }

    if (!$dry) {
        MeshAggregator::addObservation($obs);
    }
    $processed++;
    if ($processed % 100 === 0) echo "  Processed: $processed / $total\n";
}

echo "\nDone.\n";
echo "  Processed: $processed\n";
echo "  Skipped (no GPS): $skipped\n";

if (!$dry && file_exists($outPath)) {
    $content = file_get_contents($outPath);
    $agg = json_decode($content, true) ?: [];
    echo "  Mesh cells: " . count($agg) . "\n";
    echo "  File size: " . number_format(strlen($content)) . " bytes\n";

    // 上位5メッシュを表示
    uasort($agg, fn($a, $b) => ($b['total'] ?? 0) <=> ($a['total'] ?? 0));
    echo "\nTop 5 mesh cells:\n";
    foreach (array_slice($agg, 0, 5, true) as $code => $cell) {
        $groups = implode(', ', array_map(fn($g, $c) => "$g:$c", array_keys($cell['by_group'] ?? []), array_values($cell['by_group'] ?? [])));
        echo "  [$code] total={$cell['total']} | {$groups}\n";
    }
}
