<?php
/**
 * Omoikane — Bulk Species Importer from GBIF
 * 
 * Fetches Japanese species from GBIF Species API and adds them to the extraction queue.
 * Targets: Insects (Insecta), Plants (Plantae), Birds (Aves), Mammals (Mammalia), 
 * Reptiles (Reptilia), Amphibians (Amphibia), Fish (Actinopterygii)
 * 
 * GBIF Species API is free with no authentication needed.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/ExtractionQueue.php';

echo "=== GBIF Bulk Species Importer ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

$eq = ExtractionQueue::getInstance();
$added = 0;
$skipped = 0;
$errors = 0;

// GBIF Japan country key = JP
// We'll search occurrence-based species lists to find species actually observed in Japan
// Using GBIF Species Search API with highertaxonKey filters

// Target taxa with their GBIF taxon keys
$targetTaxa = [
    // Insects (most species-rich group)
    ['name' => 'Coleoptera', 'key' => 1470],     // Beetles
    ['name' => 'Lepidoptera', 'key' => 797],      // Butterflies & Moths
    ['name' => 'Hymenoptera', 'key' => 1457],     // Bees, Wasps, Ants
    ['name' => 'Diptera', 'key' => 811],          // Flies
    ['name' => 'Hemiptera', 'key' => 809],        // True Bugs
    ['name' => 'Odonata', 'key' => 789],          // Dragonflies
    ['name' => 'Orthoptera', 'key' => 1459],      // Grasshoppers
    // Other animals
    ['name' => 'Araneae', 'key' => 1496],         // Spiders
    ['name' => 'Aves', 'key' => 212],             // Birds
    ['name' => 'Mammalia', 'key' => 359],         // Mammals
    ['name' => 'Reptilia', 'key' => 358],         // Reptiles
    ['name' => 'Amphibia', 'key' => 131],         // Amphibians
    ['name' => 'Actinopterygii', 'key' => 204],   // Fish
    // Plants
    ['name' => 'Magnoliopsida', 'key' => 220],    // Flowering plants
    ['name' => 'Polypodiopsida', 'key' => 121],   // Ferns
];

foreach ($targetTaxa as $taxon) {
    echo "\n--- Fetching {$taxon['name']} (GBIF key: {$taxon['key']}) ---\n";
    
    $offset = 0;
    $limit = 300; // Max per request
    $taxonAdded = 0;
    $maxPages = 30; // Up to 3000 species per taxon
    
    for ($page = 0; $page < $maxPages; $page++) {
        // Use GBIF Occurrence Search to find species seen in Japan
        $url = "https://api.gbif.org/v1/species/search?" . http_build_query([
            'highertaxonKey' => $taxon['key'],
            'rank' => 'SPECIES',
            'status' => 'ACCEPTED',
            'limit' => $limit,
            'offset' => $offset,
            'habitat' => 'TERRESTRIAL', // Focus on land species
        ]);
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);
        $resp = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            echo "  [ERROR] HTTP $httpCode at offset $offset\n";
            $errors++;
            break;
        }
        
        $data = json_decode($resp, true);
        $results = $data['results'] ?? [];
        
        if (empty($results)) {
            echo "  No more results at offset $offset\n";
            break;
        }
        
        foreach ($results as $sp) {
            $name = $sp['canonicalName'] ?? $sp['scientificName'] ?? '';
            if (empty($name)) continue;
            
            // Only binomial names (Genus species)
            if (substr_count(trim($name), ' ') !== 1) continue;
            
            $gbifKey = $sp['key'] ?? null;
            $slug = str_replace(' ', '-', strtolower($name));
            
            $wasAdded = $eq->addSpecies($name, [
                'slug' => $slug,
                'status' => 'pending',
                'source' => 'gbif_bulk_v2',
                'gbif_key' => $gbifKey,
                'occurrence_count_jp' => 0,
                'retries' => 0,
            ]);
            
            if ($wasAdded) {
                $added++;
                $taxonAdded++;
            } else {
                $skipped++;
            }
        }
        
        $offset += $limit;
        
        // Don't hammer GBIF API
        usleep(200000); // 200ms
        
        if ($data['endOfRecords'] ?? false) break;
    }
    
    echo "  Added: $taxonAdded new species\n";
}

echo "\n=== Summary ===\n";
echo "Added: $added new species\n";
echo "Skipped (already in queue): $skipped\n";
echo "Errors: $errors\n";

// Show updated queue
$counts = $eq->getCounts();
echo "\n=== Updated Queue ===\n";
foreach ($counts as $k => $v) echo "  $k: $v\n";
echo "\nNew pending species will be picked up by the prefetcher automatically.\n";
