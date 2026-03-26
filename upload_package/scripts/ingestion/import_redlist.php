<?php
/**
 * Universal Red List Importer
 * Scans `data/redlists/*.csv` and merges them into `redlist_mapping.json`.
 * Resolves GBIF Taxonomy (The Rosetta Stone).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Taxon.php';

if (php_sapi_name() !== 'cli') {
    die("Run from CLI.");
}

$csvDir = __DIR__ . '/../data/redlists';
$files = glob($csvDir . '/*.csv');

if (empty($files)) {
    die("No CSV files found in $csvDir\n");
}

$mapping = [];
$stats = ['total' => 0, 'matched' => 0, 'new' => 0, 'merged' => 0];

foreach ($files as $file) {
    echo "Processing " . basename($file) . "...\n";
    
    $handle = fopen($file, "r");
    $headers = fgetcsv($handle); // Assuming header row exists
    
    // Normalize headers
    $headerMap = array_flip($headers);
    $required = ['scope', 'authority', 'scientific_name', 'code'];
    
    foreach ($required as $req) {
        if (!isset($headerMap[$req])) {
            echo "  Skipping file (Missing column: $req)\n";
            continue 2;
        }
    }

    while (($row = fgetcsv($handle)) !== false) {
        $stats['total']++;
        
        $sciName = $row[$headerMap['scientific_name']];
        $japaneseName = isset($headerMap['japanese_name']) ? $row[$headerMap['japanese_name']] : '';
        $scope = $row[$headerMap['scope']];
        $authority = $row[$headerMap['authority']];
        $code = $row[$headerMap['code']];
        
        echo "  $sciName ($japaneseName)... ";

        // Match Taxonomy
        $match = Taxon::match($sciName);
        
        if (isset($match['usageKey'])) {
            $key = $match['acceptedUsageKey'] ?? $match['usageKey'];
            
            // Init entry if needed
            if (!isset($mapping[$key])) {
                $mapping[$key] = [
                    'ranks' => [],
                    // Prioritize GBIF name for consistency, keep CSV name as vernacular fallback if needed
                    'name' => $japaneseName, 
                    'scientificName' => $sciName,
                    'gbifName' => $match['scientificName'],
                    'matchedKey' => $key
                ];
                $stats['new']++;
            } else {
                $stats['merged']++;
            }

            // Merge Rank
            // Allow multiple locals? Array of locals?
            // For now, simple override if scope string matches, or specific construct for "local" handling?
            // Current RedList.php logic iterates `ranks`.
            // To support multiple locals (e.g. Shizuoka Pref AND Hamamatsu City), we need unique keys in `ranks`.
            // Strategy: Use "$scope:$authority" or just sanitize authority as key?
            // Simple approach: Use $scope for global/national, but for local use authority name as sub-key?
            // Let's keep it simple: $scope is key. If "local" collision, overwrite?
            // BETTER: Use unique slug for rank key.
            
            $rankKey = $scope;
            if ($scope === 'local') {
                $rankKey = 'local_' . md5($authority); // Unique hash to allow multiple locals
            }

            $mapping[$key]['ranks'][$rankKey] = [
                'code' => $code,
                'authority' => $authority,
                'scope' => $scope // store raw scope for UI grouping
            ];
            
            echo "OK ($key)\n";
            $stats['matched']++;

        } else {
            echo "FAILED (No Match)\n";
        }
        usleep(50000); // 50ms (20 req/sec)
    }
    fclose($handle);
}

DataStore::save('redlist_mapping', $mapping);

echo "\nCompleted.\n";
echo "Total Rows: {$stats['total']}\n";
echo "Matched/Merged: {$stats['matched']}\n";
echo "Unique Taxa: " . count($mapping) . "\n";
