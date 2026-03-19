<?php

/**
 * Project OMOIKANE - Migration Script
 * Converts distilled_knowledge.json into the omoikane.sqlite3 database.
 */

require_once __DIR__ . '/../libs/OmoikaneDB.php';

echo "============================================\n";
echo " Project OMOIKANE: JSON to SQLite Migration\n";
echo "============================================\n";

$jsonFile = __DIR__ . '/../data/library/distilled_knowledge.json';
if (!file_exists($jsonFile)) {
    die("Error: distilled_knowledge.json not found.\n");
}

echo "Loading JSON data...\n";
$data = json_decode(file_get_contents($jsonFile), true);
if (!$data) {
    die("Error: Failed to parse JSON.\n");
}

$dbHelper = new OmoikaneDB();
$pdo = $dbHelper->getPDO();

$countInserted = 0;
$countSkipped = 0;

$pdo->beginTransaction();

try {
    $stmtSpecies = $pdo->prepare("
        INSERT OR IGNORE INTO species (scientific_name, distillation_status, last_distilled_at)
        VALUES (:scientific_name, :distillation_status, :last_distilled_at)
    ");

    $stmtEco = $pdo->prepare("
        INSERT OR REPLACE INTO ecological_constraints (species_id, habitat, altitude, season, notes)
        VALUES (:species_id, :habitat, :altitude, :season, :notes)
    ");

    $stmtKeys = $pdo->prepare("
        INSERT OR REPLACE INTO identification_keys (species_id, morphological_traits, similar_species, key_differences)
        VALUES (:species_id, :morphological_traits, :similar_species, :key_differences)
    ");

    foreach ($data as $identifier => $record) {
        $scientificName = $record['scientific_name'] ?? $identifier;

        // Ensure scientific name is clean (often the identifier might be a DOI, but our current format uses sci name as key)
        if (!isset($record['scientific_name'])) {
            // In our current json format from daemon_extraction_engine.php:
            // $masterKey is actually the scientific name.
            $scientificName = $identifier;
        }

        // Insert Species
        $stmtSpecies->execute([
            ':scientific_name' => $scientificName,
            ':distillation_status' => $record['distillation_status'] ?? 'pending',
            ':last_distilled_at' => $record['last_distilled_at'] ?? null
        ]);

        // Get the species ID (will be 0 if ignored, so we need to select it)
        $stmtGetId = $pdo->prepare("SELECT id FROM species WHERE scientific_name = ?");
        $stmtGetId->execute([$scientificName]);
        $speciesId = $stmtGetId->fetchColumn();

        if (!$speciesId) {
            echo "Failed to get ID for: $scientificName\n";
            $countSkipped++;
            continue;
        }

        // Insert Ecological Constraints
        if (!empty($record['ecological_constraints'])) {
            $eco = $record['ecological_constraints'];
            $stmtEco->execute([
                ':species_id' => $speciesId,
                ':habitat' => is_array($eco['habitat'] ?? '') ? implode(', ', $eco['habitat']) : ($eco['habitat'] ?? null),
                ':altitude' => $eco['altitude'] ?? null,
                ':season' => $eco['season'] ?? null,
                ':notes' => $eco['notes'] ?? null
            ]);
        }

        // Insert Identification Keys
        if (!empty($record['identification_keys'])) {
            $keys = $record['identification_keys'];
            $stmtKeys->execute([
                ':species_id' => $speciesId,
                ':morphological_traits' => is_array($keys['morphological_traits'] ?? '') ? implode("\n", $keys['morphological_traits']) : ($keys['morphological_traits'] ?? null),
                ':similar_species' => is_array($keys['similar_species'] ?? '') ? implode(', ', $keys['similar_species']) : ($keys['similar_species'] ?? null),
                ':key_differences' => is_array($keys['key_differences'] ?? '') ? implode("\n", $keys['key_differences']) : ($keys['key_differences'] ?? null)
            ]);
        }

        $countInserted++;
    }

    $pdo->commit();
    echo "\nMigration Complete!\n";
    echo "Successfully migrated: $countInserted species.\n";
    echo "Skipped/Errors: $countSkipped\n";
} catch (Exception $e) {
    $pdo->rollBack();
    die("Migration failed: " . $e->getMessage() . "\n");
}
