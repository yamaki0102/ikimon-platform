<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/OmoikaneDB.php';

$db = new OmoikaneDB();
$pdo = $db->getPDO();

// Find species that still have data
$stmt = $pdo->query("
    SELECT s.scientific_name, e.habitat, e.season, i.similar_species
    FROM species s
    JOIN ecological_constraints e ON s.id = e.species_id
    LEFT JOIN identification_keys i ON s.id = i.species_id
    WHERE e.habitat IS NOT NULL AND e.habitat != ''
    LIMIT 5
");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "Species with data:\n";
foreach ($rows as $r) {
    echo "  {$r['scientific_name']} | habitat={$r['habitat']} | season={$r['season']}\n";
}
