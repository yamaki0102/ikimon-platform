<?php
$oldPath = '/tmp/omoikane_old.sqlite3';
$curPath = '/home/yamaki/projects/ikimon-platform/upload_package/data/library/omoikane.sqlite3';

echo "=== OLD DB (jj main) ===\n";
try {
    $old = new PDO("sqlite:$oldPath");
    $old->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Tables
    $tables = $old->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
    echo "Tables: " . implode(', ', $tables) . "\n";

    // Check if species table exists
    if (in_array('species', $tables)) {
        $cnt = $old->query("SELECT COUNT(*) FROM species")->fetchColumn();
        echo "Species count: $cnt\n";
        $dist = $old->query("SELECT COUNT(*) FROM species WHERE distillation_status='distilled'")->fetchColumn();
        echo "Distilled: $dist\n";
    }

    if (in_array('ecological_constraints', $tables)) {
        $h = $old->query("SELECT COUNT(*) FROM ecological_constraints WHERE habitat IS NOT NULL AND habitat != ''")->fetchColumn();
        echo "With habitat data: $h\n";

        // Sample
        echo "\nSample habitat data:\n";
        $stmt = $old->query("SELECT s.scientific_name, e.habitat FROM species s JOIN ecological_constraints e ON s.id = e.species_id WHERE e.habitat != '' LIMIT 5");
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            echo "  {$r['scientific_name']}: {$r['habitat']}\n";
        }
    } else {
        echo "NO ecological_constraints table!\n";
    }

    if (in_array('identification_keys', $tables)) {
        $ik = $old->query("SELECT COUNT(*) FROM identification_keys WHERE morphological_traits IS NOT NULL AND morphological_traits != ''")->fetchColumn();
        echo "With ID keys: $ik\n";
    } else {
        echo "NO identification_keys table!\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

echo "\n=== CURRENT DB ===\n";
$cur = new PDO("sqlite:$curPath");
$cur->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$cnt = $cur->query("SELECT COUNT(*) FROM species")->fetchColumn();
echo "Species count: $cnt\n";
$dist = $cur->query("SELECT COUNT(*) FROM species WHERE distillation_status='distilled'")->fetchColumn();
echo "Distilled: $dist\n";
$h = $cur->query("SELECT COUNT(*) FROM ecological_constraints WHERE habitat IS NOT NULL AND habitat != ''")->fetchColumn();
echo "With habitat data: $h\n";
$ik = $cur->query("SELECT COUNT(*) FROM identification_keys WHERE morphological_traits IS NOT NULL AND morphological_traits != ''")->fetchColumn();
echo "With ID keys: $ik\n";

echo "\nCurrent DB size: " . filesize($curPath) . " bytes\n";
echo "Old DB size: " . filesize($oldPath) . " bytes\n";
