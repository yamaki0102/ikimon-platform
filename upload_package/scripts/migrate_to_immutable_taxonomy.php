<?php

/**
 * Phase 15-B: Immutable Taxonomy Migration
 * 
 * Future-proofing for 2051+ (100-year architecture).
 * Shifts the primary key for species taxonomy from string names (ja_name)
 * to immutable concept IDs (GBIF TaxonKey).
 * 
 * This script:
 * 1. Reads taxon_resolver.json to build a ja_name -> gbif_key index.
 * 2. Scans all data/redlists/*.json and injects 'taxon_id'.
 * 3. Scans all data/observations_*.json and injects 'taxon.id'.
 */

require_once __DIR__ . '/../config/config.php';

echo "Starting Immutable Taxonomy Migration...\n";

// 1. Build Index
$resolverFile = DATA_DIR . '/taxon_resolver.json';
if (!file_exists($resolverFile)) {
    die("Error: taxon_resolver.json not found.\n");
}
$resolver = json_decode(file_get_contents($resolverFile), true);

$nameToIdMap = [];
$nameToSlugMap = [];
foreach ($resolver['taxa'] as $slug => $taxon) {
    if (!empty($taxon['ja_name'])) {
        $nameToIdMap[$taxon['ja_name']] = $taxon['gbif_key'] ?? 'local:' . $slug;
        $nameToSlugMap[$taxon['ja_name']] = $slug;
    }
}
echo "Built index with " . count($nameToIdMap) . " species mappings.\n";

// 2. Migrate Red Lists
$redListPattern = DATA_DIR . '/redlists/*.json';
$redListFiles = glob($redListPattern);
foreach ($redListFiles as $file) {
    $rlData = json_decode(file_get_contents($file), true);
    $updatedCount = 0;

    if (isset($rlData['species']) && is_array($rlData['species'])) {
        foreach ($rlData['species'] as &$entry) {
            $name = $entry['ja_name'] ?? '';
            // normalize name for lookup just in case (though should match)
            $nameNorm = mb_convert_kana(trim($name), 'KVC');

            if (!isset($entry['taxon_id']) && isset($nameToIdMap[$nameNorm])) {
                $entry['taxon_id'] = $nameToIdMap[$nameNorm];
                $updatedCount++;
            }
        }
        unset($entry); // break reference

        file_put_contents($file, json_encode($rlData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        echo "Migrated Red List: " . basename($file) . " (Updated $updatedCount entries)\n";
    }
}

// 3. Migrate Observations
$obsPattern = DATA_DIR . '/observations_*.json';
$obsFiles = glob($obsPattern);
$totalObsUpdated = 0;

foreach ($obsFiles as $file) {
    $obsData = json_decode(file_get_contents($file), true);
    if (!is_array($obsData)) continue;

    $fileUpdatedCount = 0;
    foreach ($obsData as &$obs) {
        $name = $obs['taxon_name_ja'] ?? $obs['taxon']['name'] ?? null;

        // If it lacks a modern 'taxon' object, upgrade it
        if (!isset($obs['taxon'])) {
            $obs['taxon'] = [
                'name' => $name,
                'id' => null
            ];
            $fileUpdatedCount++;
        }

        // If it has a name but no ID, try to fill it
        if ($name && empty($obs['taxon']['id'])) {
            $nameNorm = mb_convert_kana(trim($name), 'KVC');
            if (isset($nameToIdMap[$nameNorm])) {
                $obs['taxon']['id'] = $nameToIdMap[$nameNorm];
                if (!isset($obs['taxon']['slug'])) {
                    $obs['taxon']['slug'] = $nameToSlugMap[$nameNorm];
                }
                $fileUpdatedCount++;
            }
        }
    }
    unset($obs);

    if ($fileUpdatedCount > 0) {
        // Atomic save wrapper (simplified for script)
        $temp = $file . '.tmp';
        file_put_contents($temp, json_encode($obsData, JSON_UNESCAPED_UNICODE));
        rename($temp, $file);
        $totalObsUpdated += $fileUpdatedCount;
        echo "Migrated Observations: " . basename($file) . " (Updated $fileUpdatedCount entries)\n";
    }
}

echo "Migration Complete! Total observations updated: $totalObsUpdated\n";
