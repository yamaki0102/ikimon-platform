<?php

/**
 * Quick diagnostic: check queue status and DB count
 */
require_once __DIR__ . '/../libs/OmoikaneDB.php';

// Queue status
$queueFile = __DIR__ . '/../data/library/extraction_queue.json';
$q = json_decode(file_get_contents($queueFile), true) ?: [];

$statuses = [];
$stuckProcessing = [];
foreach ($q as $name => $item) {
    $s = $item['status'] ?? 'unknown';
    $statuses[$s] = ($statuses[$s] ?? 0) + 1;
    if ($s === 'processing') {
        $stuckProcessing[] = $name . ' (claimed: ' . ($item['claimed_at'] ?? '?') . ', retries: ' . ($item['retries'] ?? 0) . ')';
    }
}
arsort($statuses);

echo "=== Queue Status Summary ===\n";
foreach ($statuses as $s => $c) echo "  {$s}: {$c}\n";
echo "  Total: " . count($q) . "\n\n";

if (!empty($stuckProcessing)) {
    echo "=== Stuck in 'processing' (" . count($stuckProcessing) . ") ===\n";
    foreach (array_slice($stuckProcessing, 0, 10) as $sp) echo "  - {$sp}\n";
    echo "\n";
}

// DB count
$db = new OmoikaneDB();
$pdo = $db->getPDO();
$speciesCount = $pdo->query("SELECT COUNT(*) FROM species")->fetchColumn();
$distilledCount = $pdo->query("SELECT COUNT(*) FROM species WHERE distillation_status = 'distilled'")->fetchColumn();
$ecoCount = $pdo->query("SELECT COUNT(*) FROM ecological_constraints")->fetchColumn();

echo "=== Database Status ===\n";
echo "  Species total: {$speciesCount}\n";
echo "  Distilled: {$distilledCount}\n";
echo "  With ecological data: {$ecoCount}\n";
echo "\n";

// Check WAL mode & busy_timeout
$walMode = $pdo->query("PRAGMA journal_mode")->fetchColumn();
$busyTimeout = $pdo->query("PRAGMA busy_timeout")->fetchColumn();
echo "=== DB Pragmas ===\n";
echo "  journal_mode: {$walMode}\n";
echo "  busy_timeout: {$busyTimeout}ms\n";
