<?php
require_once __DIR__ . '/upload_package/config/config.php';
require_once __DIR__ . '/upload_package/libs/BiodiversityScorer.php';

echo "--- BiodiversityScorer Verification ---\n";

// Case 1: Empty Field
echo "\nCase 1: Empty Field\n";
$obs1 = [];
$field1 = ['radius' => 500, 'biome_type' => 'urban'];
$result1 = BiodiversityScorer::calculate($obs1, $field1);
echo "Score: {$result1['total_score']} (Expected: 0)\n";
echo "Eval: {$result1['evaluation']}\n";

// Case 2: Poor Field (1 species, 1 biome, 1 observation)
echo "\nCase 2: Poor Field\n";
$obs2 = [
    ['taxon_name_ja' => 'カラス', 'biome' => 'urban']
];
$result2 = BiodiversityScorer::calculate($obs2, $field1);
echo "Score: {$result2['total_score']}\n";
echo "Richness: {$result2['breakdown']['richness']['score']}\n";
echo "Shannon: {$result2['breakdown']['shannon']['score']}\n";
echo "Biome: {$result2['breakdown']['biome']['score']}\n";

// Case 3: Rich Field (Variety of species, biomes, red list)
echo "\nCase 3: Rich Field\n";
$obs3 = [];
// 10 common species
for ($i = 0; $i < 10; $i++) $obs3[] = ['taxon_name_ja' => "Common_{$i}", 'biome' => 'forest'];
// 5 water species
for ($i = 0; $i < 5; $i++) $obs3[] = ['taxon_name_ja' => "Water_{$i}", 'biome' => 'wetland'];
// 1 Red List species (Pseudo-match logic required or mock RedListManager)
// Since RedListManager relies on actual JSON files, we might not hit Red List score unless we use real names.
// Let's use 'ニホンイシガメ' (Japanese Pond Turtle) which should be in the list if data exists.
$obs3[] = ['taxon_name_ja' => 'ニホンイシガメ', 'biome' => 'wetland', 'taxon' => ['name' => 'ニホンイシガメ']];
$obs3[] = ['taxon_name_ja' => 'オオタカ', 'biome' => 'forest', 'taxon' => ['name' => 'オオタカ']];

$field3 = ['radius' => 500, 'biome_type' => 'forest'];
$result3 = BiodiversityScorer::calculate($obs3, $field3);

echo "Score: {$result3['total_score']}\n";
echo "Richness: {$result3['breakdown']['richness']['score']} (Count: {$result3['breakdown']['richness']['raw']})\n";
echo "Shannon: {$result3['breakdown']['shannon']['score']} (Index: {$result3['breakdown']['shannon']['raw']})\n";
echo "RedList: {$result3['breakdown']['red_list']['score']} (Matches: " . implode(',', $result3['breakdown']['red_list']['matches']) . ")\n";
echo "Biome: {$result3['breakdown']['biome']['score']} (Types: " . implode(',', $result3['breakdown']['biome']['types']) . ")\n";
echo "Eval: {$result3['evaluation']}\n";
echo "Top Species: " . implode(', ', array_keys($result3['top_species'])) . "\n";

echo "\n--- Verification Complete ---\n";
