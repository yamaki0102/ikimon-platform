<?php

/**
 * Mark all existing seed/import data with import_source field.
 * 
 * - system_import → seed data from 自然共生サイト survey
 * - user_post → real user submissions (will NOT be touched)
 * 
 * This script is idempotent: running it multiple times is safe.
 * Usage: php scripts/mark_seed_data.php [--dry-run]
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';

$dryRun = in_array('--dry-run', $argv);

$obsDir = __DIR__ . '/../data/observations/';
$files = glob($obsDir . '*.json');

$stats = ['marked_seed' => 0, 'already_user' => 0, 'already_seed' => 0, 'skipped' => 0];

foreach ($files as $file) {
    $data = json_decode(file_get_contents($file), true);
    if (!is_array($data)) {
        echo "⚠ Skipping corrupt file: " . basename($file) . "\n";
        continue;
    }

    $modified = false;
    foreach ($data as &$obs) {
        // Already has import_source
        if (isset($obs['import_source'])) {
            if ($obs['import_source'] === 'user_post') {
                $stats['already_user']++;
            } else {
                $stats['already_seed']++;
            }
            continue;
        }

        // Determine source by user_id pattern
        $userId = $obs['user_id'] ?? '';

        if ($userId === 'system_import' || str_starts_with($obs['id'] ?? '', 'aikan-import-')) {
            // Seed data from batch import
            $obs['import_source'] = 'seed';
            $stats['marked_seed']++;
            $modified = true;
        } else {
            // Real user — protect it
            $obs['import_source'] = 'user_post';
            $stats['already_user']++;
            $modified = true;
        }
    }
    unset($obs);

    if ($modified && !$dryRun) {
        file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        echo "✓ Updated: " . basename($file) . "\n";
    } elseif ($modified) {
        echo "[DRY] Would update: " . basename($file) . "\n";
    }
}

echo "\n=== Summary ===\n";
echo "Marked as seed:     {$stats['marked_seed']}\n";
echo "Already user_post:  {$stats['already_user']}\n";
echo "Already seed:       {$stats['already_seed']}\n";
echo "Skipped:            {$stats['skipped']}\n";

if ($dryRun) {
    echo "\n⚡ Dry run — no files were modified.\n";
}
