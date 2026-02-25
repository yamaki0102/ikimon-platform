<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/OmoikaneDB.php';

$db = new OmoikaneDB();
$pdo = $db->getPDO();

// Count species
$total = $pdo->query("SELECT COUNT(*) FROM species")->fetchColumn();
echo "Total species in DB: $total\n\n";

// Show some completed species with their data
$rows = $pdo->query("
    SELECT s.scientific_name, s.distillation_status, s.source_citations,
           ec.habitat, ec.altitude, ec.season, ec.notes,
           ik.morphological_traits, ik.similar_species, ik.key_differences
    FROM species s
    LEFT JOIN ecological_constraints ec ON ec.species_id = s.id
    LEFT JOIN identification_keys ik ON ik.species_id = s.id
    ORDER BY s.id DESC
    LIMIT 5
")->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as $row) {
    echo "=== {$row['scientific_name']} ===\n";
    echo "  Status: {$row['distillation_status']}\n";
    echo "  Habitat: " . mb_strimwidth($row['habitat'] ?? 'N/A', 0, 100, '...') . "\n";
    echo "  Altitude: " . ($row['altitude'] ?? 'N/A') . "\n";
    echo "  Season: " . ($row['season'] ?? 'N/A') . "\n";
    echo "  Notes: " . mb_strimwidth($row['notes'] ?? 'N/A', 0, 100, '...') . "\n";
    echo "  Morphology: " . mb_strimwidth($row['morphological_traits'] ?? 'N/A', 0, 100, '...') . "\n";
    echo "  Similar: " . mb_strimwidth($row['similar_species'] ?? 'N/A', 0, 100, '...') . "\n";
    echo "  Key diff: " . mb_strimwidth($row['key_differences'] ?? 'N/A', 0, 100, '...') . "\n";
    echo "  Citations: " . mb_strimwidth($row['source_citations'] ?? 'N/A', 0, 150, '...') . "\n";
    echo "\n";
}
