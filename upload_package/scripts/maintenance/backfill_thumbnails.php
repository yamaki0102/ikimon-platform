<?php
/**
 * 既存観察画像のサムネイル一括生成スクリプト
 *
 * Usage: php backfill_thumbnails.php [--dry-run] [--limit=N]
 *
 * Options:
 *   --dry-run   実際には生成せず、対象数のみ表示
 *   --limit=N   処理する観察数を制限（デフォルト: 全件）
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/ThumbnailGenerator.php';

$dryRun = in_array('--dry-run', $argv ?? []);
$limit = null;
foreach ($argv ?? [] as $arg) {
    if (strpos($arg, '--limit=') === 0) {
        $limit = (int) substr($arg, 8);
    }
}

echo "=== Thumbnail Backfill ===\n";
echo $dryRun ? "Mode: DRY RUN\n" : "Mode: GENERATE\n";

// Pre-flight: GD extension must be available
if (!$dryRun && !extension_loaded('gd')) {
    echo "ERROR: GD extension is not available. Cannot generate thumbnails.\n";
    exit(1);
}
echo "GD: " . (extension_loaded('gd') ? "available\n" : "NOT available (dry-run only)\n");

$observations = DataStore::fetchAll('observations');
echo "Total observations: " . count($observations) . "\n";

$processed = 0;
$generated = 0;
$skipped = 0;
$errors = 0;

foreach ($observations as $obs) {
    if ($limit !== null && $processed >= $limit) break;

    if (empty($obs['photos'])) {
        $skipped++;
        continue;
    }

    $processed++;
    $id = $obs['id'] ?? 'unknown';

    foreach ($obs['photos'] as $photoPath) {
        $absPath = PUBLIC_DIR . '/' . $photoPath;
        if (!file_exists($absPath)) {
            echo "  SKIP (missing): {$photoPath}\n";
            $skipped++;
            continue;
        }

        foreach (ThumbnailGenerator::PRESETS as $suffix => $maxDim) {
            $thumbPath = ThumbnailGenerator::thumbnailPath($photoPath, $suffix);
            $absThumbPath = PUBLIC_DIR . '/' . $thumbPath;

            if (file_exists($absThumbPath)) {
                // Already exists
                continue;
            }

            if ($dryRun) {
                echo "  WOULD generate: {$thumbPath}\n";
                $generated++;
            } else {
                if (ThumbnailGenerator::resize($absPath, $absThumbPath, $maxDim)) {
                    $size = filesize($absThumbPath);
                    echo "  OK: {$thumbPath} (" . round($size / 1024, 1) . " KB)\n";
                    $generated++;
                } else {
                    echo "  ERROR: {$thumbPath}\n";
                    $errors++;
                }
            }
        }
    }

    if ($processed % 50 === 0) {
        echo "Progress: {$processed} observations processed...\n";
    }
}

echo "\n=== Summary ===\n";
echo "Observations processed: {$processed}\n";
echo "Thumbnails " . ($dryRun ? 'to generate' : 'generated') . ": {$generated}\n";
echo "Skipped: {$skipped}\n";
echo "Errors: {$errors}\n";
