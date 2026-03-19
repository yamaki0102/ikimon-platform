<?php

/**
 * recover_wiped_species.php
 * Resets wiped species (completed but no habitat data) back to 'literature_ready'
 * so the extraction daemon can re-process them WITH the safety guards.
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/OmoikaneDB.php';

$queueFile = DATA_DIR . '/library/extraction_queue.json';
$q = json_decode(file_get_contents($queueFile), true) ?: [];

$db = new OmoikaneDB();
$pdo = $db->getPDO();

$resetCount = 0;
$resetNames = [];

foreach ($q as $name => &$item) {
    if ($item['status'] !== 'completed') continue;
    if (empty($item['prefetched_literature'])) continue;

    // Check if this species has actual ecological data in DB
    $stmt = $pdo->prepare("SELECT s.id, e.habitat FROM species s LEFT JOIN ecological_constraints e ON s.id = e.species_id WHERE s.scientific_name = ?");
    $stmt->execute([$item['species_name'] ?? $name]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || empty($row['habitat'])) {
        // Wiped! Reset to literature_ready for re-processing
        $item['status'] = 'literature_ready';
        $item['retries'] = 0; // Reset retry counter
        $item['note'] = 'Auto-recovered: data was wiped by INSERT OR REPLACE bug. Reset for re-extraction.';
        $resetCount++;
        $resetNames[] = $item['species_name'] ?? $name;
    }
}
unset($item);

if ($resetCount > 0) {
    file_put_contents($queueFile, json_encode($q, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo "✅ Reset $resetCount species back to 'literature_ready' for re-extraction:\n";
    foreach ($resetNames as $n) echo "  - $n\n";
} else {
    echo "No wiped species found to recover.\n";
}
