<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/OmoikaneDB.php';

$db = new OmoikaneDB();
$pdo = $db->getPDO();

$stmt = $pdo->prepare("
    SELECT s.id, s.scientific_name, s.distillation_status,
           e.habitat, e.altitude, e.season, e.notes,
           i.morphological_traits, i.similar_species, i.key_differences
    FROM species s
    LEFT JOIN ecological_constraints e ON s.id = e.species_id
    LEFT JOIN identification_keys i ON s.id = i.species_id
    WHERE s.scientific_name = 'Ciconia nigra'
");
$stmt->execute();
$row = $stmt->fetch(PDO::FETCH_ASSOC);
echo "Direct DB query for Ciconia nigra:\n";
print_r($row);
