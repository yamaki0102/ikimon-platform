<?php

/**
 * Backfill Observation Embeddings — 768 Dimensions (Matryoshka)
 *
 * Re-enqueues all observations for embedding (re)generation at 768 dimensions.
 * The actual embedding work is handled by EmbeddingQueue::processPending() /
 * the existing queue processor (scripts/process_embedding_queue.php).
 *
 * Use this when:
 *   - Migrating from the old JSON-based EmbeddingStore (any dimension)
 *   - Migrating from 3072-dim → 768-dim (4× storage reduction)
 *   - Re-embedding after prepareObservationText() improvements
 *
 * Usage:
 *   php backfill_embeddings_768.php [options]
 *
 * Options:
 *   --dry-run   Show what would be enqueued without doing anything
 *   --force     Re-enqueue even if observation already has a 768-dim embedding
 *   --limit=N   Only process first N observations (for testing)
 */

require_once __DIR__ . '/../config/config.php';
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

echo "=== Observation Embedding Backfill (768-dim) ===\n";
echo "Mode : " . ($dryRun ? "DRY RUN" : "LIVE") . "\n";
echo "Force: " . ($force ? "YES (re-enqueue even if 768-dim exists)" : "NO") . "\n";
if ($limit) echo "Limit: {$limit}\n";
echo "\n";

$observations = DataStore::fetchAll('observations');
$total = count($observations);
echo "Total observations : {$total}\n";

$enqueued          = 0;
$skippedNoContent  = 0;
$skippedAlready768 = 0;

foreach ($observations as $obs) {
    if ($limit && $enqueued >= $limit) break;

    $id = (string) ($obs['id'] ?? '');
    if ($id === '') continue;

    // Skip observations with no embeddable content
    if (!EmbeddingQueue::shouldQueueObservation($obs)) {
        $skippedNoContent++;
        continue;
    }

    // Skip if already has a 768-dim embedding (unless --force)
    if (!$force) {
        $existing = EmbeddingStore::get('observations', $id);
        // SQLite store's get() returns 'v' as unpacked float array
        if ($existing && is_array($existing['v'] ?? null) && count($existing['v']) >= 768) {
            $skippedAlready768++;
            continue;
        }
    }

    if (!$dryRun) {
        EmbeddingQueue::enqueue($id, 'backfill_768');
    }
    $enqueued++;
}

// Release SQLite connection
EmbeddingStore::clearCache();

echo "\nResults:\n";
echo "  Enqueued              : {$enqueued}" . ($dryRun ? " (would enqueue)" : "") . "\n";
echo "  Skipped (no content)  : {$skippedNoContent}\n";
echo "  Skipped (already 768) : {$skippedAlready768}\n";
echo "\n";

if (!$dryRun && $enqueued > 0) {
    $estMin = ceil($enqueued / 60);
    echo "Done! Run 'php scripts/process_embedding_queue.php' or wait for cron.\n";
    echo "At ~60 req/min (free tier), estimated processing time: ~{$estMin} minutes.\n";
} elseif ($dryRun) {
    echo "Dry run complete. Remove --dry-run to execute.\n";
} else {
    echo "Nothing to do.\n";
}
