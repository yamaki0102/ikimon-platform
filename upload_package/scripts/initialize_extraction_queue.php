<?php

/**
 * initialize_extraction_queue.php
 * Aggregates all species from observations and taxon_resolver
 * to create the Master Queue for the Extraction Engine.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';

echo "Initializing Master Extraction Queue (Target: 100k Species)...\n";

// Helper to check for invalid names
function isInvalidTaxonName($name)
{
    if (empty($name)) return true;
    $invalidKeywords = ['Key to ', 'Unknown', '不明', '概説続き', '系統分類', '出典', '参考文献'];
    foreach ($invalidKeywords as $kw) {
        if (stripos($name, $kw) !== false) {
            return true;
        }
    }
    return false;
}

$queueFile = DATA_DIR . '/library/extraction_queue.json';
$queue = file_exists($queueFile) ? json_decode(file_get_contents($queueFile), true) : [];

$newSpeciesCount = 0;

// 1. Gather all observed species (Priority: High)
echo "Fetching observed species...\n";
$observations = DataStore::fetchAll('observations');
foreach ($observations as $obs) {
    if ($obs['status'] === 'active' || $obs['status'] === 'approved') {
        $name = $obs['taxon']['name'] ?? ($obs['species_name'] ?? null);
        if ($name && $name !== 'Unknown' && $name !== '不明') {
            $name = trim($name);
            if (isInvalidTaxonName($name)) continue;

            if (!isset($queue[$name])) {
                $queue[$name] = [
                    'species_name' => $name,
                    'status' => 'pending',
                    'source' => 'observation',
                    'retries' => 0,
                    'last_processed_at' => null,
                    'error_message' => null
                ];
                $newSpeciesCount++;
            } else {
                // Upgrade source if already exists but from resolver
                if ($queue[$name]['source'] !== 'observation') {
                    $queue[$name]['source'] = 'observation';
                }
            }
        }
    }
}
echo "Found " . count($observations) . " total observations. Queue size: " . count($queue) . "\n";

// 2. Gather all species from taxon_resolver.json
echo "Fetching species from taxon_resolver...\n";
$taxonData = DataStore::get('taxon_resolver', 0);
if (!empty($taxonData['taxa'])) {
    foreach ($taxonData['taxa'] as $slug => $taxon) {
        $name = $taxon['accepted_name'] ?? null;
        $jaName = $taxon['ja_name'] ?? null;
        if (!empty($jaName)) {
            $jaName = trim(preg_replace('/\\s*\\(続き\\)\\s*/u', '', $jaName));
            if (isInvalidTaxonName($jaName)) {
                $jaName = null;
            }
        }

        $displayName = $name;
        if (empty($displayName)) {
            $displayName = $jaName;
        }

        if ($displayName) {
            $displayName = trim($displayName);
            if (isInvalidTaxonName($displayName)) continue;

            if (!isset($queue[$displayName])) {
                $queue[$displayName] = [
                    'species_name' => $displayName,
                    'ja_name' => $jaName,
                    'slug' => $slug,
                    'status' => 'pending',
                    'source' => 'resolver',
                    'retries' => 0,
                    'last_processed_at' => null,
                    'error_message' => null
                ];
                $newSpeciesCount++;
            }
        }
    }
}
echo "Taxon resolver processing complete. Total Master Queue Size: " . count($queue) . "\n";

// Save queue
$dir = dirname($queueFile);
if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}
file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo "Added $newSpeciesCount new species to the queue.\n";
echo "Master Extraction Queue initialization finished successfully!\n";
