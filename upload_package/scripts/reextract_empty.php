<?php
/**
 * Omoikane v2.0 — Re-extract completed species with empty data
 * 
 * Old Qwen3 extractions had 4.2% habitat fill rate.
 * This script re-queues completed species that have:
 *   1. Literature cached in the queue
 *   2. Empty or missing habitat/keys in the DB
 * 
 * Safe to run: only changes status from 'completed' to 'literature_ready'
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/ExtractionQueue.php';
require_once __DIR__ . '/../libs/OmoikaneDB.php';

echo "=== Omoikane v2.0 Re-extraction Script ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

$eq = ExtractionQueue::getInstance();
$qPdo = $eq->getPDO();

// Get DB to check which species have empty data
$oDB = new OmoikaneDB();
$dbPdo = $oDB->getPDO();

// Find species with empty ecological data
$emptySpecies = $dbPdo->query("
    SELECT s.scientific_name
    FROM species s
    LEFT JOIN ecological_constraints ec ON s.id = ec.species_id
    LEFT JOIN identification_keys ik ON s.id = ik.species_id
    WHERE s.distillation_status = 'distilled'
    AND (
        ec.habitat IS NULL OR ec.habitat = ''
    )
    AND (
        ik.morphological_traits IS NULL OR ik.morphological_traits = ''
    )
")->fetchAll(PDO::FETCH_COLUMN);

echo "Species with empty habitat AND keys: " . count($emptySpecies) . "\n";

// Re-queue those that have cached literature
$requeued = 0;
$skipped = 0;
$stmt = $qPdo->prepare("
    UPDATE queue 
    SET status = 'literature_ready', retries = 0, note = 'v2.0 re-extraction'
    WHERE species_name = :name 
    AND status = 'completed'
    AND prefetched_literature IS NOT NULL
    AND length(prefetched_literature) > 20
");

foreach ($emptySpecies as $name) {
    $stmt->execute([':name' => $name]);
    if ($stmt->rowCount() > 0) {
        $requeued++;
    } else {
        $skipped++;
    }
}

echo "\n✅ Re-queued: $requeued species\n";
echo "⏭️  Skipped (no literature or not completed): $skipped\n";

// Show updated counts
$counts = $eq->getCounts();
echo "\n=== Updated Queue ===\n";
foreach ($counts as $k => $v) echo "  $k: $v\n";
