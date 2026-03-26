<?php
require_once __DIR__ . '/../config/config.php';

$queueFile = DATA_DIR . '/library/extraction_queue.json';
$q = json_decode(file_get_contents($queueFile), true) ?: [];

$total = count($q);
$completed = 0;
$litReady = 0;
$pending = 0;
$withLit = 0;
$failed = 0;

foreach ($q as $name => $item) {
    if ($item['status'] === 'completed') $completed++;
    elseif ($item['status'] === 'literature_ready') $litReady++;
    elseif ($item['status'] === 'pending') $pending++;
    elseif ($item['status'] === 'failed') $failed++;

    if (!empty($item['prefetched_literature'])) $withLit++;
}

echo "Queue stats:\n";
echo "  Total: $total\n";
echo "  Completed: $completed\n";
echo "  Literature Ready: $litReady\n";
echo "  Pending: $pending\n";
echo "  Failed: $failed\n";
echo "  Has prefetched literature: $withLit\n";

// Check wiped species - completed/distilled in queue but no data in DB
require_once __DIR__ . '/../libs/OmoikaneDB.php';
$db = new OmoikaneDB();
$pdo = $db->getPDO();

$wipedCount = 0;
$wipedNames = [];
foreach ($q as $name => $item) {
    if ($item['status'] === 'completed') {
        $stmt = $pdo->prepare("SELECT s.id, e.habitat FROM species s LEFT JOIN ecological_constraints e ON s.id = e.species_id WHERE s.scientific_name = ?");
        $stmt->execute([$item['species_name'] ?? $name]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row || empty($row['habitat'])) {
            $wipedCount++;
            $hasLit = !empty($item['prefetched_literature']) ? 'YES' : 'NO';
            if ($wipedCount <= 5) {
                $wipedNames[] = "{$name} (lit: {$hasLit})";
            }
        }
    }
}
echo "\nWiped species (completed but no habitat data): $wipedCount\n";
echo "Sample wiped:\n";
foreach ($wipedNames as $w) echo "  $w\n";
