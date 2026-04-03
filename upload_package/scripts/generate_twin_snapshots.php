<?php
/**
 * Twin Snapshot Generator — CLI/Cron用
 *
 * 全登録サイトの生態ツインスナップショットを一括生成。
 * 週次cronまたは手動実行を想定。
 *
 * Usage:
 *   php scripts/generate_twin_snapshots.php
 *   php scripts/generate_twin_snapshots.php --site=site-001
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/SiteTwinSnapshot.php';

$startTime = microtime(true);

$specificSite = null;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--site=')) {
        $specificSite = substr($arg, 7);
    }
}

if ($specificSite) {
    echo "Generating snapshot for site: {$specificSite}\n";
    $snapshot = SiteTwinSnapshot::generate($specificSite);
    if ($snapshot) {
        $speciesCount = count($snapshot['species_state']);
        echo "  OK — {$speciesCount} species, activity={$snapshot['activity']['activity_level']}\n";
        if ($snapshot['comparison']) {
            $delta = $snapshot['comparison']['species_count_delta'];
            $sign = $delta >= 0 ? '+' : '';
            echo "  Δ species: {$sign}{$delta}";
            if (!empty($snapshot['comparison']['species_gained'])) {
                echo " | gained: " . implode(', ', array_slice($snapshot['comparison']['species_gained'], 0, 5));
            }
            echo "\n";
        }
    } else {
        echo "  FAILED — site not found or no data\n";
    }
} else {
    echo "Generating twin snapshots for all sites...\n";
    $results = SiteTwinSnapshot::generateAll();

    $success = 0;
    $failed = 0;
    foreach ($results as $siteId => $ok) {
        if ($ok) {
            $success++;
            echo "  ✓ {$siteId}\n";
        } else {
            $failed++;
            echo "  ✗ {$siteId}\n";
        }
    }

    echo "\nDone: {$success} succeeded, {$failed} failed\n";
}

$elapsed = round((microtime(true) - $startTime) * 1000);
echo "Elapsed: {$elapsed}ms\n";
