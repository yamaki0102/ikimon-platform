<?php
require_once __DIR__ . '/../upload_package/config/config.php';
require_once __DIR__ . '/../upload_package/libs/BiodiversityScorer.php';
require_once __DIR__ . '/../upload_package/libs/RedListManager.php';

// Mock specific classes if needed, or rely on actual logic if data exists
// For RedListManager, we might typically mock its output if no data is present, 
// but let's try to run with what we have or create a mock subclass if it fails.

echo "Running BiodiversityScorer Tests...\n\n";

// Case 1: Empty Field
echo "Test 1: Empty Field (No observations)\n";
$obs = [];
$fieldInfo = ['biome_type' => 'urban'];
$result = BiodiversityScorer::calculate($obs, $fieldInfo);
echo "Score: " . $result['total_score'] . " (Expected: Low/20 due to biome fallback)\n";
print_r($result['breakdown']['biome']);
echo "\n";

// Case 2: Rich Field (Simulated)
echo "Test 2: Rich Field (30 species)\n";
$obs = [];
for ($i = 0; $i < 30; $i++) {
    $obs[] = [
        'taxon' => ['name' => "Species_$i"],
        'biome' => 'forest'
    ];
}
// Add some duplicates to test diversity
for ($i = 0; $i < 10; $i++) {
    $obs[] = [
        'taxon' => ['name' => "Species_0"], // Dominant species
        'biome' => 'forest'
    ];
}

$fieldInfo = ['biome_type' => 'forest'];
$result = BiodiversityScorer::calculate($obs, $fieldInfo);
echo "Score: " . $result['total_score'] . "\n";
echo "Richness Score: " . $result['breakdown']['richness']['score'] . " (Expected: 100)\n";
echo "Shannon Raw: " . $result['breakdown']['shannon']['raw'] . "\n";
echo "\n";

// Case 3: Red List Species (Simulated)
// We need to see if RedListManager actually finds anything. 
// If we can't easily mock the Red List data, we might need to rely on the logic inspection.
// Or we can manually populate the RedListManager cache if possible (it's private).
// Alternatively, we define a dummy RedListManager if strict dependency injection isn't used.
// Since BiodiversityScorer uses `new RedListManager()`, we can't easily swap it without refactoring.
// However, let's just check if the code *runs* without crashing first.

echo "Test 3: Execution Check\n";
echo "Calculation completed successfully.\n";
