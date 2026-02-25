<?php

/**
 * Backfill taxon_slug, scientific_name, and gbif_key
 * for existing observations using taxon_resolver.json
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';

// Load resolver
$resolverFile = DATA_DIR . '/taxon_resolver.json';
$resolver = json_decode(file_get_contents($resolverFile), true);
$jpIndex = $resolver['jp_index'] ?? [];
$taxa = $resolver['taxa'] ?? [];

// Load all observations
$observations = DataStore::fetchAll('observations');
$updated = 0;
$notFound = [];

foreach ($observations as &$obs) {
    $name = $obs['taxon']['name'] ?? null;
    if (!$name) continue;
    if (!empty($obs['taxon']['slug'])) continue; // Already has slug

    // Look up in jp_index
    $slug = $jpIndex[$name] ?? null;

    if ($slug && isset($taxa[$slug])) {
        $taxonData = $taxa[$slug];
        $obs['taxon']['slug'] = $slug;

        // Also backfill scientific_name and gbif_key if missing
        if (empty($obs['taxon']['scientific_name']) && !empty($taxonData['accepted_name'])) {
            $obs['taxon']['scientific_name'] = $taxonData['accepted_name'];
        }
        if (empty($obs['taxon']['key']) && !empty($taxonData['gbif_key'])) {
            $obs['taxon']['key'] = $taxonData['gbif_key'];
        }

        $updated++;
        echo "[OK] $name -> $slug\n";
    } else {
        $notFound[$name] = ($notFound[$name] ?? 0) + 1;
    }
}
unset($obs);

// Save back
if ($updated > 0) {
    // DataStore saves per-partition, need to save the full dataset
    // Find the partition files and update them
    $partDir = DATA_DIR . '/observations';
    if (is_dir($partDir)) {
        // Re-index by id for lookup
        $obsById = [];
        foreach ($observations as $o) {
            $obsById[$o['id']] = $o;
        }

        // Update each partition file
        $files = glob($partDir . '/*.json');
        $fileUpdated = 0;
        foreach ($files as $file) {
            $partData = json_decode(file_get_contents($file), true);
            if (!is_array($partData)) continue;

            $changed = false;
            foreach ($partData as &$item) {
                $id = $item['id'] ?? null;
                if ($id && isset($obsById[$id]) && !empty($obsById[$id]['taxon']['slug'])) {
                    $item['taxon'] = $obsById[$id]['taxon'];
                    $changed = true;
                }
            }
            unset($item);

            if ($changed) {
                file_put_contents($file, json_encode($partData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
                $fileUpdated++;
            }
        }
        echo "\nPartition files updated: $fileUpdated\n";
    } else {
        // Single file mode
        $file = DATA_DIR . '/observations.json';
        file_put_contents($file, json_encode($observations, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }
}

echo "\n=== Summary ===\n";
echo "Total updated: $updated\n";
echo "Not found in resolver: " . count($notFound) . "\n";
if ($notFound) {
    foreach ($notFound as $n => $c) {
        echo "  - $n ($c records)\n";
    }
}
