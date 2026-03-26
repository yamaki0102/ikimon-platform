<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/OmoikaneDB.php';

$db = new OmoikaneDB();
$pdo = $db->getPDO();

// Find species with the most complete data
$rows = $pdo->query("
    SELECT s.scientific_name, 
           ec.habitat, ec.altitude, ec.season, ec.notes,
           ik.morphological_traits, ik.similar_species, ik.key_differences,
           s.source_citations
    FROM species s
    LEFT JOIN ecological_constraints ec ON ec.species_id = s.id
    LEFT JOIN identification_keys ik ON ik.species_id = s.id
    WHERE ec.habitat IS NOT NULL AND ec.habitat != ''
      AND ik.morphological_traits IS NOT NULL AND ik.morphological_traits != ''
    LIMIT 3
")->fetchAll(PDO::FETCH_ASSOC);

echo "=== Species with complete data ===\n\n";
foreach ($rows as $row) {
    echo "━━━ {$row['scientific_name']} ━━━\n";
    echo "🌿 Habitat: {$row['habitat']}\n";
    echo "🏔 Altitude: {$row['altitude']}\n";
    echo "📅 Season: {$row['season']}\n";
    echo "📝 Notes: " . mb_strimwidth($row['notes'] ?? '', 0, 200, '...') . "\n";
    echo "🔬 Morphology: " . mb_strimwidth($row['morphological_traits'] ?? '', 0, 200, '...') . "\n";
    echo "🔄 Similar: " . mb_strimwidth($row['similar_species'] ?? '', 0, 200, '...') . "\n";
    echo "💡 Key diff: " . mb_strimwidth($row['key_differences'] ?? '', 0, 200, '...') . "\n";
    echo "📚 Citations: " . mb_strimwidth($row['source_citations'] ?? '', 0, 200, '...') . "\n";
    echo "\n";
}

if (empty($rows)) {
    echo "(No species found with both habitat and morphological data)\n";
    echo "Checking what data exists...\n\n";

    // Check how many have ecological data
    $ecCount = $pdo->query("SELECT COUNT(*) FROM ecological_constraints WHERE habitat != ''")->fetchColumn();
    $ikCount = $pdo->query("SELECT COUNT(*) FROM identification_keys WHERE morphological_traits != ''")->fetchColumn();
    echo "Species with habitat data: $ecCount\n";
    echo "Species with morphology data: $ikCount\n";

    // Show one with any data
    $row = $pdo->query("
        SELECT s.scientific_name, ec.habitat, ec.notes, ik.morphological_traits, ik.similar_species
        FROM species s
        LEFT JOIN ecological_constraints ec ON ec.species_id = s.id
        LEFT JOIN identification_keys ik ON ik.species_id = s.id
        WHERE (ec.habitat != '' OR ik.morphological_traits != '')
        LIMIT 1
    ")->fetch();
    if ($row) {
        echo "\nSample: {$row['scientific_name']}\n";
        echo "  Habitat: {$row['habitat']}\n";
        echo "  Morphology: " . mb_strimwidth($row['morphological_traits'] ?? '', 0, 200, '...') . "\n";
        echo "  Similar: " . mb_strimwidth($row['similar_species'] ?? '', 0, 200, '...') . "\n";
    }
}
