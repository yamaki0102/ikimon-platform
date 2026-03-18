<?php

/**
 * Embed Omoikane Species — Batch Embedding Generator
 *
 * Reads all distilled species from omoikane.sqlite3, generates 768-dim embeddings
 * via Gemini Embedding 2 (RETRIEVAL_DOCUMENT), and stores them in the SQLite-based
 * EmbeddingStore (type='omoikane').
 *
 * Usage:
 *   php embed_omoikane_species.php [options]
 *
 * Options:
 *   --dry-run         Preview counts without calling API or writing
 *   --force           Re-embed species that already have an embedding
 *   --limit=N         Process at most N species (useful for testing)
 *   --batch=N         API batch size (default: 5; keep low to stay under 60 req/min free tier)
 *   --min-trust=0.0   Minimum trust_score to embed (default: 0.0 = all distilled)
 *   --offset=N        Skip first N species (resume from checkpoint)
 *
 * Rate limits (Gemini free tier):
 *   60 requests/min → with --batch=5: 12 batches/min → 60 species/min
 *   1M species at 60/min ≈ 277 hours → use paid tier or chunked nightly runs
 *
 * Checkpointing:
 *   If interrupted, re-run with --offset=N where N = last reported "processed" count.
 *   The store's ON CONFLICT DO UPDATE means re-processing is always safe.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/EmbeddingService.php';
require_once __DIR__ . '/../libs/EmbeddingStore.php';
require_once __DIR__ . '/../libs/OmoikaneDB.php';

// ─── Parse CLI options ───────────────────────────────────────────────────────

$dryRun   = in_array('--dry-run', $argv);
$force    = in_array('--force', $argv);
$limit    = 0;
$batchSz  = 5;
$minTrust = 0.0;
$offset   = 0;

foreach ($argv as $arg) {
    if (str_starts_with($arg, '--limit='))     $limit    = max(1, (int) substr($arg, 8));
    if (str_starts_with($arg, '--batch='))     $batchSz  = max(1, min(100, (int) substr($arg, 8)));
    if (str_starts_with($arg, '--min-trust=')) $minTrust = max(0.0, (float) substr($arg, 12));
    if (str_starts_with($arg, '--offset='))   $offset   = max(0, (int) substr($arg, 9));
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

echo "=== Omoikane Species Embedding ===\n";
echo "Model     : " . EmbeddingService::class . " → gemini-embedding-2-preview @ 768-dim\n";
echo "Mode      : " . ($dryRun ? "DRY RUN" : "LIVE") . "\n";
echo "Force     : " . ($force ? "YES (re-embed existing)" : "NO (skip existing)") . "\n";
echo "Batch size: {$batchSz}\n";
echo "Min trust : {$minTrust}\n";
if ($offset) echo "Offset    : {$offset} (resume from here)\n";
if ($limit)  echo "Limit     : {$limit}\n";
echo "\n";

if (!defined('GEMINI_API_KEY') || !GEMINI_API_KEY) {
    echo "ERROR: GEMINI_API_KEY is not defined in config.php\n";
    exit(1);
}

$service = new EmbeddingService();
$db      = new OmoikaneDB();
$pdo     = $db->getPDO();

// ─── Count total distilled species ──────────────────────────────────────────

$countSql = "SELECT COUNT(*) FROM species WHERE distillation_status = 'distilled'";
if ($minTrust > 0.0) {
    $countSql = "
        SELECT COUNT(*) FROM species s
        LEFT JOIN trust_scores ts ON s.id = ts.species_id
        WHERE s.distillation_status = 'distilled'
          AND COALESCE(ts.trust_score, 0.0) >= :min_trust
    ";
}
$countStmt = $pdo->prepare($countSql);
if ($minTrust > 0.0) $countStmt->bindValue(':min_trust', $minTrust, PDO::PARAM_STR);
$countStmt->execute();
$totalDistilled = (int) $countStmt->fetchColumn();
echo "Distilled species in DB : {$totalDistilled}\n";
echo "Already embedded (omoikane type): " . EmbeddingStore::count('omoikane') . "\n\n";

// ─── Query: all distilled species with ecology + morphology ─────────────────

$sql = "
    SELECT
        s.id,
        s.scientific_name,
        s.japanese_name,
        e.habitat,
        e.altitude,
        e.season,
        e.notes,
        k.morphological_traits,
        k.similar_species,
        k.key_differences,
        COALESCE(ts.trust_score, 0.0) AS trust_score
    FROM species s
    LEFT JOIN ecological_constraints e  ON s.id = e.species_id
    LEFT JOIN identification_keys k     ON s.id = k.species_id
    LEFT JOIN trust_scores ts           ON s.id = ts.species_id
    WHERE s.distillation_status = 'distilled'
";
if ($minTrust > 0.0) {
    $sql .= " AND COALESCE(ts.trust_score, 0.0) >= :min_trust";
}
$sql .= " ORDER BY s.id ASC LIMIT -1 OFFSET :offset";

$stmt = $pdo->prepare($sql);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
if ($minTrust > 0.0) $stmt->bindValue(':min_trust', $minTrust, PDO::PARAM_STR);
$stmt->execute();

// ─── Main loop ──────────────────────────────────────────────────────────────

$processed  = 0;
$embedded   = 0;
$skipped    = 0;
$failed     = 0;
$startTime  = microtime(true);
$batch      = [];   // accumulate species for batch API call
$batchRows  = [];   // parallel: keep original rows

function flushBatch(
    array &$batch,
    array &$batchRows,
    EmbeddingService $service,
    bool $dryRun,
    int &$embedded,
    int &$failed
): void {
    if (empty($batch)) return;

    if ($dryRun) {
        $embedded += count($batch);
        $batch = $batchRows = [];
        return;
    }

    // Build batchEmbed requests
    $requests = [];
    foreach ($batch as $text) {
        $requests[] = [
            'parts'    => [['text' => $text]],
            'taskType' => 'RETRIEVAL_DOCUMENT',
        ];
    }

    $vectors = $service->batchEmbed($requests);

    foreach ($batchRows as $i => $row) {
        $vector = $vectors[$i] ?? null;
        if (!is_array($vector) || count($vector) < 128) {
            echo "  [FAIL] {$row['scientific_name']} (no vector returned)\n";
            $failed++;
            continue;
        }

        EmbeddingStore::save('omoikane', (string) $row['id'], $vector, [
            'mode'            => 'text_only',
            'scientific_name' => $row['scientific_name'],
            'japanese_name'   => $row['japanese_name'] ?? '',
            'trust_score'     => (float) $row['trust_score'],
        ]);
        $embedded++;
    }

    $batch = $batchRows = [];

    // Polite delay: ~5 batches/min with batch=5 → ~25 req/min (well under 60 limit)
    // Increase batch size and reduce sleep for paid tier
    usleep(200000); // 200ms between batch calls
}

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    if ($limit && $processed >= $limit) break;
    $processed++;

    $speciesId = (string) $row['id'];

    // Skip if already embedded (unless --force)
    if (!$force && EmbeddingStore::exists('omoikane', $speciesId)) {
        $skipped++;
        continue;
    }

    // Prepare text representation
    $text = EmbeddingService::prepareOmoikaneText($row);
    if (trim($text) === '') {
        echo "  [SKIP] {$row['scientific_name']} (empty text)\n";
        $skipped++;
        continue;
    }

    $batch[]    = $text;
    $batchRows[] = $row;

    // Flush when batch is full
    if (count($batch) >= $batchSz) {
        flushBatch($batch, $batchRows, $service, $dryRun, $embedded, $failed);
    }

    // Progress report every 100 species
    if ($processed % 100 === 0) {
        $elapsed  = microtime(true) - $startTime;
        $rate     = $elapsed > 0 ? round($processed / $elapsed) : 0;
        $eta      = ($rate > 0 && $totalDistilled > 0)
            ? round(($totalDistilled - $offset - $processed) / $rate / 60, 1)
            : '?';
        printf(
            "  [%d] processed=%d embedded=%d skipped=%d failed=%d  rate=%d/s  ETA≈%s min\n",
            time(), $processed, $embedded, $skipped, $failed, $rate, $eta
        );
    }
}

// Flush remaining
flushBatch($batch, $batchRows, $service, $dryRun, $embedded, $failed);

// ─── Summary ────────────────────────────────────────────────────────────────

$elapsed = round(microtime(true) - $startTime, 1);

echo "\n=== Done ===\n";
echo "Elapsed       : {$elapsed}s\n";
echo "Processed     : {$processed}\n";
echo "Embedded      : {$embedded}" . ($dryRun ? " (would embed)" : "") . "\n";
echo "Skipped       : {$skipped}\n";
echo "Failed        : {$failed}\n";
echo "Total in store: " . EmbeddingStore::count('omoikane') . "\n";

if ($dryRun) {
    echo "\nDry run complete. Remove --dry-run to execute.\n";
} elseif ($failed > 0) {
    echo "\nSome failures occurred. Check the output above.\n";
    echo "Re-run with --offset=" . ($offset + $processed) . " to resume, or --force to retry all.\n";
} else {
    echo "\nAll done! EmbeddingStore is ready for semantic species search.\n";
}
