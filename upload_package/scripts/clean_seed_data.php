<?php

/**
 * Clean Seed Data — Safely remove test/import data while preserving user content.
 * 
 * SAFETY: Only removes observations with import_source === "seed".
 * User posts (import_source === "user_post" or no marker) are NEVER touched.
 * 
 * Usage: php scripts/clean_seed_data.php [--confirm]
 */

require_once __DIR__ . '/../config/config.php';

$confirm = in_array('--confirm', $argv);

$obsDir = __DIR__ . '/../data/observations/';
$files = glob($obsDir . '*.json');

$stats = ['seed_removed' => 0, 'user_kept' => 0, 'unknown_kept' => 0];
$seedList = [];

foreach ($files as $file) {
    $data = json_decode(file_get_contents($file), true);
    if (!is_array($data)) continue;

    $keep = [];
    foreach ($data as $obs) {
        $source = $obs['import_source'] ?? null;

        if ($source === 'seed') {
            $stats['seed_removed']++;
            $name = $obs['taxon']['name'] ?? ($obs['species_name'] ?? '?');
            $seedList[] = "[DEL] {$obs['id']} — {$name}";
        } else {
            $keep[] = $obs;
            if ($source === 'user_post') {
                $stats['user_kept']++;
            } else {
                $stats['unknown_kept']++;
            }
        }
    }

    if (count($keep) < count($data)) {
        if ($confirm) {
            if (empty($keep)) {
                // Remove empty file
                unlink($file);
                echo "🗑 Removed empty file: " . basename($file) . "\n";
            } else {
                file_put_contents($file, json_encode($keep, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
                echo "✓ Cleaned: " . basename($file) . " (" . (count($data) - count($keep)) . " seed records removed)\n";
            }
        } else {
            echo "[PREVIEW] " . basename($file) . ": would remove " . (count($data) - count($keep)) . " seed records, keep " . count($keep) . "\n";
        }
    }
}

echo "\n=== Summary ===\n";
echo "Seed records " . ($confirm ? "removed" : "to remove") . ": {$stats['seed_removed']}\n";
echo "User records kept:    {$stats['user_kept']}\n";
echo "Unknown records kept: {$stats['unknown_kept']}\n";

if (!empty($seedList) && !$confirm) {
    echo "\nSeed records that would be deleted:\n";
    foreach (array_slice($seedList, 0, 20) as $item) {
        echo "  $item\n";
    }
    if (count($seedList) > 20) {
        echo "  ... and " . (count($seedList) - 20) . " more\n";
    }
    echo "\n⚡ Run with --confirm to actually delete.\n";
}
