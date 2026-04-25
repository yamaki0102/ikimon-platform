<?php
/**
 * cleanup_unidentified_audio.php
 *
 * 未同定（ai_classified / unverified）のまま7日以上経過した音声ファイルを削除。
 * 同定済み（verified / community_confirmed）の音声は永続保持。
 *
 * Usage: php cleanup_unidentified_audio.php [--dry-run]
 * Cron:  0 3 * * * php /path/to/cleanup_unidentified_audio.php
 */

require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/DataStore.php';

$dryRun = in_array('--dry-run', $argv ?? [], true);
$maxAgeDays = 7;
$cutoff = time() - ($maxAgeDays * 86400);

$preserveStages = ['ai_classified', 'verified', 'community_confirmed', 'expert_confirmed'];

$observations = DataStore::fetchAll('observations');
$audioDir = PUBLIC_DIR . '/uploads/audio';

$referencedPaths = [];
$preservedPaths = [];

foreach ($observations as $obs) {
    $path = $obs['audio_evidence_path'] ?? null;
    if (!$path) continue;

    $referencedPaths[] = $path;
    $stage = $obs['verification_stage'] ?? 'unverified';
    if (in_array($stage, $preserveStages, true)) {
        $preservedPaths[] = $path;
    }
}

$deleted = 0;
$preserved = 0;
$orphaned = 0;

if (!is_dir($audioDir)) {
    echo "Audio directory not found: {$audioDir}\n";
    exit(0);
}

$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($audioDir, RecursiveDirectoryIterator::SKIP_DOTS)
);

foreach ($iterator as $file) {
    if (!$file->isFile()) continue;

    $fullPath = $file->getPathname();
    $relativePath = 'uploads/audio/' . str_replace('\\', '/', substr($fullPath, strlen($audioDir) + 1));

    if (in_array($relativePath, $preservedPaths, true)) {
        $preserved++;
        continue;
    }

    if ($file->getMTime() > $cutoff) {
        continue;
    }

    if ($dryRun) {
        echo "[DRY-RUN] Would delete: {$relativePath}\n";
    } else {
        unlink($fullPath);
        echo "Deleted: {$relativePath}\n";
    }

    if (!in_array($relativePath, $referencedPaths, true)) {
        $orphaned++;
    }
    $deleted++;
}

echo "\n--- Summary ---\n";
echo "Preserved (identified): {$preserved}\n";
echo "Deleted (old/unidentified): {$deleted}" . ($dryRun ? " [DRY-RUN]" : "") . "\n";
echo "Orphaned (no observation ref): {$orphaned}\n";
