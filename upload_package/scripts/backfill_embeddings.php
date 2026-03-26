<?php

/**
 * Backfill Embeddings — Batch script for ikimon.life
 *
 * Generates embeddings for all existing observations, papers, and taxons
 * using Gemini Embedding 2 (multimodal).
 *
 * Usage:
 *   php scripts/backfill_embeddings.php --type=all
 *   php scripts/backfill_embeddings.php --type=observations [--force]
 *   php scripts/backfill_embeddings.php --type=papers [--batch-size=5]
 *   php scripts/backfill_embeddings.php --type=taxons
 *
 * Options:
 *   --type        observations|papers|taxons|all (required)
 *   --force       Regenerate even if embedding already exists
 *   --batch-size  Items per batch API call (default: 5, max: 10)
 *   --delay       Seconds between batches (default: 1)
 */

// Bootstrap
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/PaperStore.php';
require_once __DIR__ . '/../libs/EmbeddingService.php';
require_once __DIR__ . '/../libs/EmbeddingStore.php';

// Parse args
$opts = getopt('', ['type:', 'force', 'batch-size:', 'delay:']);
$type = $opts['type'] ?? null;
$force = isset($opts['force']);
$batchSize = min((int) ($opts['batch-size'] ?? 5), 10);
$delay = max((int) ($opts['delay'] ?? 1), 0);

if (!$type || !in_array($type, ['observations', 'papers', 'taxons', 'all'])) {
    echo "Usage: php backfill_embeddings.php --type=observations|papers|taxons|all [--force] [--batch-size=5]\n";
    exit(1);
}

$svc = new EmbeddingService();
$startTime = microtime(true);

$types = $type === 'all' ? ['observations', 'papers', 'taxons'] : [$type];

foreach ($types as $t) {
    echo "\n=== Backfilling: {$t} ===\n";

    match ($t) {
        'observations' => backfillObservations($svc, $force, $batchSize, $delay),
        'papers' => backfillPapers($svc, $force, $batchSize, $delay),
        'taxons' => backfillTaxons($svc, $force, $batchSize, $delay),
    };

    EmbeddingStore::clearCache();
}

$elapsed = round(microtime(true) - $startTime, 1);
echo "\n=== Done in {$elapsed}s ===\n";

// ─── Observation backfill (multimodal + photo_only) ────────────

function backfillObservations(EmbeddingService $svc, bool $force, int $batchSize, int $delay): void
{
    $observations = DataStore::fetchAll('observations');
    $total = count($observations);
    echo "Found {$total} observations\n";

    $done = 0;
    $skipped = 0;
    $failed = 0;

    foreach ($observations as $obs) {
        $id = $obs['id'] ?? null;
        if (!$id) continue;

        $done++;
        $prefix = "[{$done}/{$total}]";

        // Skip if already embedded (unless --force)
        if (!$force && EmbeddingStore::exists('observations', $id)) {
            $skipped++;
            continue;
        }

        // 1. Multimodal embedding (text + photo)
        $result = $svc->embedObservation($obs);
        if ($result) {
            $text = EmbeddingService::prepareObservationText($obs);
            EmbeddingStore::save('observations', $id, $result['vector'], [
                'mode' => $result['mode'],
                'text' => mb_substr($text, 0, 200),
                'has_photo' => !empty($obs['photos']),
            ]);
            echo "{$prefix} {$id} → {$result['mode']} OK\n";
        } else {
            $failed++;
            echo "{$prefix} {$id} → FAILED\n";
        }

        // 2. Photo-only embedding (for visual similarity)
        if (!empty($obs['photos'])) {
            if (!$force && EmbeddingStore::exists('photos', $id)) {
                // already exists
            } else {
                $photoVec = $svc->embedObservationPhoto($obs);
                if ($photoVec) {
                    EmbeddingStore::save('photos', $id, $photoVec, [
                        'mode' => 'photo_only',
                    ]);
                }
            }
        }

        EmbeddingStore::clearCache(); // flush to disk each item
        if ($delay > 0) sleep($delay);
    }

    echo "Observations: done={$done} skipped={$skipped} failed={$failed}\n";
}

// ─── Paper backfill (text-only, with batch API) ────────────────

function backfillPapers(EmbeddingService $svc, bool $force, int $batchSize, int $delay): void
{
    $papers = PaperStore::fetchAll();
    $total = count($papers);
    echo "Found {$total} papers\n";

    $done = 0;
    $skipped = 0;
    $failed = 0;

    // Collect items that need embedding
    $pending = [];
    foreach ($papers as $paper) {
        $id = $paper['id'] ?? $paper['doi'] ?? null;
        if (!$id) continue;

        if (!$force && EmbeddingStore::exists('papers', $id)) {
            $skipped++;
            continue;
        }

        $text = EmbeddingService::preparePaperText($paper);
        if (trim($text) === '') continue;

        $pending[] = ['id' => $id, 'text' => $text];
    }

    echo "Need to embed: " . count($pending) . " (skipped: {$skipped})\n";

    // Process in batches
    $batches = array_chunk($pending, $batchSize);
    foreach ($batches as $batchIdx => $batch) {
        $requests = [];
        foreach ($batch as $item) {
            $requests[] = [
                'parts' => [['text' => mb_substr($item['text'], 0, 2000)]],
                'taskType' => 'RETRIEVAL_DOCUMENT',
            ];
        }

        $vectors = $svc->batchEmbed($requests);

        foreach ($batch as $i => $item) {
            $done++;
            if ($vectors[$i] !== null) {
                EmbeddingStore::save('papers', $item['id'], $vectors[$i], [
                    'mode' => 'text_only',
                    'text' => mb_substr($item['text'], 0, 200),
                ]);
            } else {
                $failed++;
            }
        }

        $batchNum = $batchIdx + 1;
        $totalBatches = count($batches);
        echo "Batch {$batchNum}/{$totalBatches}: embedded " . count($batch) . " papers\n";

        EmbeddingStore::clearCache();
        if ($delay > 0) sleep($delay);
    }

    echo "Papers: done={$done} skipped={$skipped} failed={$failed}\n";
}

// ─── Taxon backfill (text-only, with batch API) ────────────────

function backfillTaxons(EmbeddingService $svc, bool $force, int $batchSize, int $delay): void
{
    $resolverPath = DATA_DIR . '/taxon_resolver.json';
    if (!file_exists($resolverPath)) {
        echo "taxon_resolver.json not found, skipping.\n";
        return;
    }

    $resolver = json_decode(file_get_contents($resolverPath), true) ?: [];
    $taxa = $resolver['taxa'] ?? [];
    $total = count($taxa);
    echo "Found {$total} taxa in resolver\n";

    $done = 0;
    $skipped = 0;
    $failed = 0;

    $pending = [];
    foreach ($taxa as $slug => $taxon) {
        if (!$force && EmbeddingStore::exists('taxons', $slug)) {
            $skipped++;
            continue;
        }

        $text = EmbeddingService::prepareTaxonText($taxon);
        if (trim($text) === '') continue;

        $pending[] = ['id' => $slug, 'text' => $text];
    }

    echo "Need to embed: " . count($pending) . " (skipped: {$skipped})\n";

    $batches = array_chunk($pending, $batchSize);
    foreach ($batches as $batchIdx => $batch) {
        $requests = [];
        foreach ($batch as $item) {
            $requests[] = [
                'parts' => [['text' => mb_substr($item['text'], 0, 2000)]],
                'taskType' => 'RETRIEVAL_DOCUMENT',
            ];
        }

        $vectors = $svc->batchEmbed($requests);

        foreach ($batch as $i => $item) {
            $done++;
            if ($vectors[$i] !== null) {
                EmbeddingStore::save('taxons', $item['id'], $vectors[$i], [
                    'mode' => 'text_only',
                    'text' => mb_substr($item['text'], 0, 200),
                ]);
            } else {
                $failed++;
            }
        }

        $batchNum = $batchIdx + 1;
        $totalBatches = count($batches);
        echo "Batch {$batchNum}/{$totalBatches}: embedded " . count($batch) . " taxa\n";

        EmbeddingStore::clearCache();
        if ($delay > 0) sleep($delay);
    }

    echo "Taxons: done={$done} skipped={$skipped} failed={$failed}\n";
}
