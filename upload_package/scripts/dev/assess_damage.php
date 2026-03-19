<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/OmoikaneDB.php';

$db = new OmoikaneDB();
$pdo = $db->getPDO();

// Total species
$total = $pdo->query("SELECT COUNT(*) FROM species")->fetchColumn();
echo "Total species in DB: $total\n";

// Distilled species
$distilled = $pdo->query("SELECT COUNT(*) FROM species WHERE distillation_status = 'distilled'")->fetchColumn();
echo "Distilled: $distilled\n";

// Species WITH actual ecological data
$withData = $pdo->query("
    SELECT COUNT(*) FROM species s
    JOIN ecological_constraints e ON s.id = e.species_id
    WHERE e.habitat IS NOT NULL AND e.habitat != ''
")->fetchColumn();
echo "Species with habitat data: $withData\n";

// Species WITH actual identification data
$withId = $pdo->query("
    SELECT COUNT(*) FROM species s
    JOIN identification_keys i ON s.id = i.species_id
    WHERE i.morphological_traits IS NOT NULL AND i.morphological_traits != ''
")->fetchColumn();
echo "Species with ID keys: $withId\n";

// Species marked distilled but NO ecological data (= wiped)
$wiped = $pdo->query("
    SELECT COUNT(*) FROM species s
    LEFT JOIN ecological_constraints e ON s.id = e.species_id
    WHERE s.distillation_status = 'distilled'
    AND (e.habitat IS NULL OR e.habitat = '')
")->fetchColumn();
echo "Distilled but NO habitat data (potentially wiped): $wiped\n";

// Show some with data
echo "\nSample species with data:\n";
$stmt = $pdo->query("
    SELECT s.scientific_name, e.habitat, e.season
    FROM species s
    JOIN ecological_constraints e ON s.id = e.species_id
    WHERE e.habitat IS NOT NULL AND e.habitat != ''
    LIMIT 10
");
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
    echo "  {$r['scientific_name']} | {$r['habitat']}\n";
}
