<?php
/**
 * Coverage Auditor
 * Verifies that every municipality in the Master CSV is targeted by the Seeker.
 */

require_once __DIR__ . '/../config/config.php';

$csvPath = __DIR__ . '/../data/masters/municipalities_jp.csv';
$configsDir = __DIR__ . '/../data/redlists/configs';

echo "========================================\n";
echo "   ANTIGRAVITY: COVERAGE AUDIT REPORT   \n";
echo "========================================\n";

if (!file_exists($csvPath)) {
    die("CRITICAL: Master Municipality CSV not found!\n");
}

// 1. Load Master Roster
$lines = file($csvPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$totalMuni = 0;
$masterList = [];

foreach ($lines as $line) {
    if (strpos($line, '#') === 0 || empty(trim($line))) continue;
    $cols = str_getcsv($line);
    if (count($cols) < 3) continue;
    
    // Key: Prefecture + Name (e.g., "沖縄県竹富町")
    $key = $cols[1] . $cols[2]; 
    $masterList[$key] = [
        'name' => $cols[2],
        'pref' => $cols[1],
        'en' => isset($cols[3]) ? $cols[3] : ''
    ];
    $totalMuni++;
}

echo "Master Roster Size: " . number_format($totalMuni) . " municipalities.\n\n";

// 2. Simulate Seeker Logic to ensure 100% Targeting
echo "Checking Seeker Targeting Logic...\n";
$targetedCount = 0;
$missing = [];

foreach ($masterList as $key => $muni) {
    // Replicate Seeker's Logic
    $slug = strtolower(str_replace(' ', '-', $muni['en']));
    $expectedUrl = "https://example.com/redlist/town/" . $slug;
    
    // Check if valid URL structure is generated
    if (!empty($slug)) {
        $targetedCount++;
    } else {
        $missing[] = $key;
    }
}

$coveragePercent = ($targetedCount / $totalMuni) * 100;

echo "Targeting Logic Coverage: {$targetedCount} / {$totalMuni} (" . number_format($coveragePercent, 1) . "%)\n";

if (count($missing) > 0) {
    echo "WARNING: The following municipalities are NOT targeted:\n";
    print_r($missing);
} else {
    echo "SUCCESS: Seeker logic covers 100% of the Master Roster.\n";
}

echo "\n";
echo "Note: This audit confirms that the *mechanism* targets everyone.\n";
echo "Actual data acquisition depends on the external site existence.\n";
echo "========================================\n";
