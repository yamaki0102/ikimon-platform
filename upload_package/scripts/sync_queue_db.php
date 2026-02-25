<?php

/**
 * Sync SQLite queue with distilled species in main DB
 */
date_default_timezone_set('Asia/Tokyo');
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/OmoikaneDB.php';
require_once __DIR__ . '/../libs/ExtractionQueue.php';

$eq = new ExtractionQueue();

// Get all distilled species from DB
$db = new OmoikaneDB();
$pdo = $db->getPDO();
$stmt = $pdo->query("SELECT scientific_name FROM species WHERE distillation_status = 'distilled'");
$distilled = $stmt->fetchAll(PDO::FETCH_COLUMN);
$distilledSet = array_flip($distilled);

$synced = $eq->syncWithDistilledDB($distilledSet);

echo "Synced: $synced species marked completed\n";
echo "Distilled in DB: " . count($distilled) . "\n";

// Show remaining queue status
$counts = $eq->getCounts();
arsort($counts);
echo "\nQueue after sync:\n";
foreach ($counts as $s => $c) {
    if ($s !== 'total') echo "  $s: $c\n";
}
