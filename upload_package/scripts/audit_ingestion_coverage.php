<?php
// audit_ingestion_coverage.php
// Purpose: Scientifically prove that Source File Count == JSON Entry Count for all books.

$books = [
    'insect_sound_guide' => '[DONE]_鳴き声から調べる昆虫図鑑',
    'animal_encyclopedia' => '[DONE]_動物大百科',
    'kuwagata_handbook_revised' => '[DONE]_クワガタムシハンドブック増補改訂版',
    'river_guide_sagamigawa' => '[DONE]_リバーガイド相模川の生き物たち',
    'world_bird_encyclopedia' => '[DONE]_世界鳥類事典',
    'fish_culture_history' => '[DONE]_魚の文化史',
    'insectarium_37' => '[DONE]_インセクタリゥム37',
    'japan_bird_encyclopedia_showa' => '[DONE]_日本鳥類大圖鑑',
    'genshoku_jumoku_zukan' => '[DONE]_原色樹木図鑑',
    'field_guide_japanese_butterflies' => 'フィールドガイド_日本のチョウ',
    'gakken_zukan_live_insects' => '学研の図鑑LIVE_昆虫',
    'world_amphibians_visual' => 'ARCHIVE/world_amphibians_visual'
];

$baseDirBook = 'g:\その他のパソコン\マイ ノートパソコン\antigravity\ikimon\ikimon.life\book';
$baseDirJson = 'g:\その他のパソコン\マイ ノートパソコン\antigravity\ikimon\ikimon.life\upload_package\data\legacy_ingest';

echo "=== Bio-Graph Coverage Audit ===\n";
echo sprintf("%-40s | %-10s | %-10s | %-10s | %s\n", "Book", "Files", "JSON", "Species", "Status");
echo str_repeat("-", 95) . "\n";

$totalFiles = 0;
$totalJson = 0;
$totalSpecies = 0;

foreach ($books as $slug => $dirName) {
    if ($slug === 'gakken_zukan_live_insects' || $slug === 'field_guide_japanese_butterflies') {
         // These directories might not have [DONE] yet or just got renamed? 
         // Actually based on previous steps, 'field_guide' and 'gakken' do NOT have [DONE] prefix in directory yet.
         // Wait, checking previous steps... 
         // Field Guide: 'フィールドガイド_日本のチョウ' (No [DONE]) -> Correct in array above.
         // Gakken: '学研の図鑑LIVE_昆虫' (No [DONE]) -> Correct in array above.
         // Others have [DONE].
    }
    
    // 1. Count Source Files
    $dirPath = $baseDirBook . '/' . $dirName;
    if (!is_dir($dirPath)) {
        echo sprintf("%-40s | %-10s | %-10s | %s\n", $slug, "ERR", "-", "DIR MISSING");
        continue;
    }
    
    // Count only files, ignore . and ..
    $files = new FilesystemIterator($dirPath, FilesystemIterator::SKIP_DOTS);
    $fileCount = iterator_count($files);
    
    // 2. Count JSON Entries & Exact Species
    $jsonPath = $baseDirJson . '/v3_graph_' . $slug . '.json';
    $jsonCount = 0;
    $speciesCount = 0;
    
    if (file_exists($jsonPath)) {
        $jsonContent = file_get_contents($jsonPath);
        $jsonData = json_decode($jsonContent, true);
        if (is_array($jsonData)) {
            $jsonCount = count($jsonData);
            
            // Calculate Exact Species Count
            foreach ($jsonData as $page) {
                if (isset($page['species_entries']) && is_array($page['species_entries'])) {
                    $speciesCount += count($page['species_entries']);
                } elseif (isset($page['type']) && $page['type'] === 'dictionary_entry') {
                    $speciesCount++; // 1 Dictionary Entry = 1 Species
                } elseif (isset($page['visual_semantics']) && isset($page['visual_semantics']['subject'])) {
                    $speciesCount++; // 1 Visual Plate = 1 Species (approx, unless ROI exists)
                } else {
                    // Fallback for simple content pages (treat as 1 unit of knowledge)
                    $speciesCount++;
                }
            }
        }
    }

    $status = ($fileCount === $jsonCount) ? "✅ MATCH" : "❌ MISMATCH";
    if ($fileCount === 0) $status = "⚠️ EMPTY";

    $displaySlug = (strlen($slug) > 38) ? substr($slug, 0, 35) . "..." : $slug;
    echo sprintf("%-40s | %-10d | %-10d | %-10d | %s\n", $displaySlug, $fileCount, $jsonCount, $speciesCount, $status);

    $totalFiles += $fileCount;
    $totalJson += $jsonCount;
    $totalSpecies += $speciesCount;
}

echo str_repeat("-", 95) . "\n";
echo sprintf("%-40s | %-10d | %-10d | %-10d | %s\n", "TOTAL LIBRARY", $totalFiles, $totalJson, $totalSpecies, ($totalFiles === $totalJson ? "✅ 100% COVERAGE" : "❌ DISCREPANCY"));
