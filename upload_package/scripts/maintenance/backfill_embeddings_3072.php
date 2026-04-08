<?php

/**
 * Backfill Embeddings to 3072 Dimensions
 *
 * Re-enqueues all observations for embedding regeneration at 3072 dimensions.
 * The actual re-embedding is handled by the existing EmbeddingQueue processor.
 *
 * Usage:
 *   php backfill_embeddings_3072.php [--dry-run] [--force] [--limit=N]
 *
 * Options:
 *   --dry-run   Show what would be enqueued without actually doing it
 *   --force     Re-enqueue even if observation already has a 3072-dim embedding
 *   --limit=N   Only enqueue first N observations (for testing)
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/EmbeddingStore.php';
require_once __DIR__ . '/../libs/EmbeddingQueue.php';

$dryRun = in_array('--dry-run', $argv);
$force  = in_array('--force', $argv);
$limit  = 0;

foreach ($argv as $arg) {
    if (str_starts_with($arg, '--limit=')) {
        $limit = max(1, (int) substr($arg, 8));
    }
}

echo "=== Embedding Backfill to 3072 dimensions ===\n";
echo "Mode: " . ($dryRun ? "DRY RUN" : "LIVE") . "\n";
echo "Force: " . ($force ? "YES" : "NO") . "\n";
if ($limit) echo "Limit: {$limit}\n";
echo "\n";

// Load all observations
$observations = DataStore::fetchAll('observations');
$total = count($observations);
echo "Total observations: {$total}\n";

$enqueued = 0;
$skippedNoContent = 0;
$skippedAlready3072 = 0;

foreach ($observations as $obs) {
    if ($limit && $enqueued >= $limit) break;

    $id = $obs['id'] ?? '';
    if ($id === '') continue;

    // Skip observations with no embeddable content
    if (!EmbeddingQueue::shouldQueueObservation($obs)) {
        $skippedNoContent++;
        continue;
    }

    // Check if already has 3072-dim embedding (unless --force)
    if (!$force) {
        $existing = EmbeddingStore::get('observations', $id);
        if ($existing && is_array($existing['v'] ?? null) && count($existing['v']) >= 3072) {
            $skippedAlready3072++;
            continue;
        }
    }

    if (!$dryRun) {
        EmbeddingQueue::enqueue($id, 'backfill_3072');
    }
    $enqueued++;
}

// Clear store cache to free memory
EmbeddingStore::clearCache();

echo "\nResults:\n";
echo "  Enqueued:              {$enqueued}" . ($dryRun ? " (would enqueue)" : "") . "\n";
echo "  Skipped (no content):  {$skippedNoContent}\n";
echo "  Skipped (already 3072): {$skippedAlready3072}\n";
echo "\n";

if (!$dryRun && $enqueued > 0) {
    echo "Done! Run 'php scripts/process_embedding_queue.php' or wait for cron to process.\n";
    echo "At ~60 req/min free tier, estimated time: ~" . ceil($enqueued / 60) . " minutes.\n";
} elseif ($dryRun) {
    echo "Dry run complete. Remove --dry-run to execute.\n";
}
