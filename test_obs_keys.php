<?php
require __DIR__ . '/upload_package/config/config.php';

// Check data_quality field
$f = DATA_DIR . '/observations/2025-07.json';
$obs = json_decode(file_get_contents($f), true);
echo "=== data_quality field ===\n";
$o = $obs[0];
echo "data_quality type: " . gettype($o['data_quality'] ?? null) . "\n";
echo "data_quality value: " . json_encode($o['data_quality'] ?? null) . "\n\n";

// Check second observation
$o2 = $obs[5] ?? $obs[1];
echo "obs[5] data_quality: " . json_encode($o2['data_quality'] ?? null) . "\n\n";

// Count RG / Needs ID
$dir = DATA_DIR . '/observations';
$allObs = [];
foreach (glob($dir . '/*.json') as $file) {
    $data = json_decode(file_get_contents($file), true) ?: [];
    $allObs = array_merge($allObs, $data);
}
$dqDist = [];
foreach ($allObs as $x) {
    $dq = $x['data_quality'] ?? 'N/A';
    if (is_array($dq)) $dq = json_encode($dq);
    $dqDist[$dq] = ($dqDist[$dq] ?? 0) + 1;
}
echo "data_quality distribution:\n";
print_r($dqDist);

// Check taxon rank distribution  
echo "\n=== taxon.rank distribution ===\n";
$ranks = [];
foreach ($allObs as $x) {
    $r = $x['taxon']['rank'] ?? 'unknown';
    $ranks[$r] = ($ranks[$r] ?? 0) + 1;
}
arsort($ranks);
print_r($ranks);

// Check taxon source distribution
echo "\n=== taxon.source distribution ===\n";
$sources = [];
foreach ($allObs as $x) {
    $s = $x['taxon']['source'] ?? 'unknown';
    $sources[$s] = ($sources[$s] ?? 0) + 1;
}
print_r($sources);

// Check if any taxon has additional hierarchy fields
echo "\n=== Sample taxon objects ===\n";
for ($i = 0; $i < min(3, count($allObs)); $i++) {
    echo "obs[$i] taxon: " . json_encode($allObs[$i]['taxon'] ?? []) . "\n";
}
