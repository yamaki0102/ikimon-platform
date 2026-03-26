<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Services/LibraryService.php';

$r = LibraryService::getDistilledKnowledgeForTaxon('Ciconia nigra');
echo "Result:\n";
print_r($r);

// Check if distilled
require_once __DIR__ . '/../libs/OmoikaneDB.php';
$db = new OmoikaneDB();
$pdo = $db->getPDO();
$stmt = $pdo->prepare("SELECT scientific_name, distillation_status FROM species WHERE scientific_name LIKE '%Ciconia%'");
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "\nSpecies rows matching Ciconia:\n";
print_r($rows);
