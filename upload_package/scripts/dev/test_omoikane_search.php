<?php

/**
 * CLI Test Script for OmoikaneSearchEngine
 * Verifies the execution time and accuracy of multi-dimensional reverse lookups.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/OmoikaneSearchEngine.php';

echo "============================================\n";
echo " Omoikane Reverse-Lookup Engine Diagnostics \n";
echo "============================================\n";

$engine = new OmoikaneSearchEngine();

$testCases = [
    ['habitat' => 'forest'],
    ['season' => 'summer'],
    ['keyword' => 'red'],
    ['habitat' => 'mountain', 'season' => 'spring'],
    ['keyword' => 'wing']
];

foreach ($testCases as $idx => $filters) {
    echo "\n[Test Case " . ($idx + 1) . "] Filters: " . json_encode($filters) . "\n";

    $start = microtime(true);
    // Suppress errors directly, we want to see output
    try {
        $results = $engine->search($filters, 5, 0);
        $time = (microtime(true) - $start) * 1000;

        echo " -> Found " . count($results) . " results in " . round($time, 2) . " ms.\n";
        foreach ($results as $i => $row) {
            echo "    " . ($i + 1) . ". {$row['scientific_name']}\n";
        }
    } catch (\Exception $e) {
        echo " -> ERROR: " . $e->getMessage() . "\n";
    }
}
echo "\nTesting complete.\n";
